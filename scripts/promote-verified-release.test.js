import { describe, expect, it } from "vitest";
import { platformServices } from "../config/platform-services.mjs";
import {
  activeDeployment,
  createRollbackManifest,
  createStagingReceipt,
  rollbackToManifest,
  validateRollbackManifest,
  validateStagingReceipt,
  verifyReleaseHealth,
} from "./promote-verified-release.mjs";

const sha = "a".repeat(40);
const previousSha = "b".repeat(40);
const now = "2026-10-21T00:00:00.000Z";

function uuid(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function deployments(environment, message = sha) {
  return platformServices.services.map((service, index) => ({
    serviceId: service.id,
    workerName: environment === "staging" ? service.stagingName : service.productionName,
    config: service.config,
    deployOrder: service.deployOrder,
    deploymentId: uuid(index + 1),
    versionId: uuid(index + 101),
    message,
    createdAt: now,
  }));
}

function stagingReceipt() {
  return createStagingReceipt({ releaseSha: sha, deployments: deployments("staging"), verifiedAt: now });
}

function rollbackManifest() {
  return createRollbackManifest({
    releaseSha: sha,
    stagingReceipt: stagingReceipt(),
    deployments: deployments("production", previousSha),
    capturedAt: now,
  });
}

function status(serviceId, versionId, message = previousSha) {
  return {
    id: uuid(platformServices.services.findIndex(({ id }) => id === serviceId) + 1),
    annotations: { "workers/message": message },
    versions: [{ version_id: versionId, percentage: 100 }],
    created_on: now,
  };
}

describe("verified release promotion", () => {
  it("accepts only one active 100% version attributed to the staged SHA", () => {
    const service = platformServices.services[0];
    expect(activeDeployment(service, "staging", status(service.id, uuid(101), sha), sha)).toMatchObject({
      serviceId: service.id,
      versionId: uuid(101),
      message: sha,
    });
    expect(() => activeDeployment(service, "staging", {
      ...status(service.id, uuid(101), sha),
      versions: [{ version_id: uuid(101), percentage: 50 }, { version_id: uuid(102), percentage: 50 }],
    }, sha)).toThrow("must have one active version");
    expect(() => activeDeployment(service, "staging", status(service.id, uuid(101), previousSha), sha)).toThrow(`expected ${sha}`);
  });

  it("rejects stale or cross-release staging receipts", () => {
    const receipt = stagingReceipt();
    expect(validateStagingReceipt(receipt, sha, Date.parse(now) + 59 * 60_000)).toBe(receipt);
    expect(() => validateStagingReceipt(receipt, "c".repeat(40), Date.parse(now))).toThrow("not ccccc");
    expect(() => validateStagingReceipt(receipt, sha, Date.parse(now) + 61 * 60_000)).toThrow("stale");
  });

  it("requires an exact rollback target for every service", () => {
    const manifest = rollbackManifest();
    expect(validateRollbackManifest(manifest, sha, Date.parse(now))).toBe(manifest);
    expect(() => validateRollbackManifest({ ...manifest, services: manifest.services.slice(1) }, sha, Date.parse(now))).toThrow("every service");
    expect(() => validateRollbackManifest({ ...manifest, promotionSha: previousSha }, sha, Date.parse(now))).toThrow("another promotion");
  });

  it("restores changed services in reverse dependency order and verifies each target", () => {
    const manifest = rollbackManifest();
    const current = new Map(manifest.services.map((target, index) => [target.serviceId, uuid(index + 501)]));
    const commands = [];
    const serviceForConfig = new Map(platformServices.services.map((service) => [service.config, service]));
    const runJson = (args) => {
      const config = args[args.indexOf("--config") + 1];
      const service = serviceForConfig.get(config);
      return status(service.id, current.get(service.id));
    };
    const runCommand = (args) => {
      const config = args[args.indexOf("--config") + 1];
      const service = serviceForConfig.get(config);
      current.set(service.id, args[1]);
      commands.push(service.id);
    };
    const results = rollbackToManifest(manifest, sha, { runJson, runCommand, now: Date.parse(now) });
    expect(commands).toEqual([...platformServices.services].reverse().map(({ id }) => id));
    expect(results).toHaveLength(platformServices.services.length);
    expect(results.every(({ restored }) => restored)).toBe(true);
  });

  it("requires exact release health and every dependency readiness check", async () => {
    const serviceNames = ["connections", "telemetry", "activity", "planning", "feedback", "core-api", "scheduler", "gateway"];
    const ready = {
      status: "ok",
      checks: Object.fromEntries(["database", "backgroundWorker", "deliveryQueue", "connections", "planning", "feedback", "telemetry", "activity", "scheduler"].map((key) => [key, true])),
      versions: Object.fromEntries(["noxhere", "background", "connections", "planning", "feedback", "telemetry", "activity", "scheduler"].map((key) => [key, sha])),
    };
    const contracts = {
      contractVersion: 1,
      kind: "health-contracts",
      status: "ok",
      buildSha: sha,
      services: serviceNames.map((service) => ({ service, live: true, ready: true, buildSha: sha })),
    };
    const fetchImpl = async (url) => Response.json(
      String(url).includes("/api/health/ready")
        ? ready
        : String(url).includes("/health/contracts")
          ? contracts
          : { service: "noxhere", plane: "public-platform", status: "ok" },
    );
    await expect(verifyReleaseHealth("https://example.test", sha, fetchImpl)).resolves.toMatchObject({ readiness: ready });
    await expect(verifyReleaseHealth("https://example.test", previousSha, fetchImpl)).rejects.toThrow("noxhere readiness");
  });
});
