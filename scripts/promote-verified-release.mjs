import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platformServices } from "../config/platform-services.mjs";
import { validateHealthContracts } from "./check-health-contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules/.bin/wrangler");
const FULL_SHA = /^[0-9a-f]{40}$/;
const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const RECEIPT_MAX_AGE_MS = 60 * 60 * 1000;
const ROLLBACK_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const REQUIRED_STAGING_CHECKS = [
  "smoke",
  "api-surface",
  "login-acceptance",
  "readiness",
  "health-contracts",
  "deployment-versions",
];

function fail(message) {
  throw new Error(`Release promotion refused: ${message}`);
}

function isoDate(value, label) {
  const timestamp = Date.parse(String(value ?? ""));
  if (!Number.isFinite(timestamp)) fail(`${label} is not a valid timestamp`);
  return timestamp;
}

function assertSha(value, label = "release SHA") {
  if (!FULL_SHA.test(String(value ?? ""))) fail(`${label} must be a full lowercase Git commit SHA`);
  return value;
}

function option(args, name, required = true) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (required && (!value || value.startsWith("--"))) fail(`${name} is required`);
  return value;
}

function writeJson(path, value) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    fail(`${label} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function environmentArgs(environment) {
  return environment === "staging" ? ["--env", "staging"] : ["--env="];
}

export function runWranglerJson(args) {
  const output = execFileSync(wrangler, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  try { return JSON.parse(output); }
  catch { fail(`Wrangler did not return JSON for: wrangler ${args.join(" ")}`); }
}

function serviceDescriptor(service, environment) {
  return {
    serviceId: service.id,
    workerName: environment === "staging" ? service.stagingName : service.productionName,
    config: service.config,
    deployOrder: service.deployOrder,
  };
}

export function activeDeployment(service, environment, status, expectedSha) {
  const descriptor = serviceDescriptor(service, environment);
  if (!status || typeof status !== "object") fail(`${descriptor.workerName} has no active deployment`);
  if (!VERSION_ID.test(String(status.id ?? ""))) fail(`${descriptor.workerName} has an invalid deployment id`);
  if (!Array.isArray(status.versions) || status.versions.length !== 1) {
    fail(`${descriptor.workerName} must have one active version before promotion`);
  }
  const version = status.versions[0];
  if (!VERSION_ID.test(String(version?.version_id ?? "")) || Number(version?.percentage) !== 100) {
    fail(`${descriptor.workerName} must route 100% of traffic to one valid version`);
  }
  const message = status.annotations?.["workers/message"] ?? null;
  if (expectedSha && message !== expectedSha) {
    fail(`${descriptor.workerName} is attributed to ${message ?? "no release"}; expected ${expectedSha}`);
  }
  return {
    ...descriptor,
    deploymentId: status.id,
    versionId: version.version_id,
    message,
    createdAt: status.created_on,
  };
}

export function collectActiveDeployments({
  environment,
  expectedSha,
  inspectVersion = false,
  runJson = runWranglerJson,
}) {
  if (environment !== "staging" && environment !== "production") fail("environment must be staging or production");
  return platformServices.services.map((service) => {
    const envArgs = environmentArgs(environment);
    const status = runJson(["deployments", "status", "--config", service.config, ...envArgs, "--json"]);
    const deployment = activeDeployment(service, environment, status, expectedSha);
    if (inspectVersion) {
      const version = runJson(["versions", "view", deployment.versionId, "--config", service.config, ...envArgs, "--json"]);
      if (version?.id !== deployment.versionId) fail(`${deployment.workerName} rollback version is unavailable`);
    }
    return deployment;
  });
}

export function validateStagingReceipt(receipt, expectedSha, now = Date.now()) {
  assertSha(expectedSha);
  if (receipt?.schemaVersion !== 1 || receipt?.kind !== "noxhere.staging-verification") fail("invalid staging receipt");
  if (receipt.environment !== "staging") fail("verification receipt is not for staging");
  if (receipt.releaseSha !== expectedSha) fail(`staging receipt is for ${receipt.releaseSha ?? "unknown"}, not ${expectedSha}`);
  if (receipt.origin !== platformServices.origins.staging) fail("staging receipt has an unexpected origin");
  const age = now - isoDate(receipt.verifiedAt, "staging verification time");
  if (age < -60_000 || age > RECEIPT_MAX_AGE_MS) fail("staging verification receipt is stale");
  for (const check of REQUIRED_STAGING_CHECKS) {
    if (!receipt.checks?.includes(check)) fail(`staging receipt is missing ${check}`);
  }
  if (!Array.isArray(receipt.deployments) || receipt.deployments.length !== platformServices.services.length) {
    fail("staging receipt does not cover every service");
  }
  for (const service of platformServices.services) {
    const deployment = receipt.deployments.find(({ serviceId }) => serviceId === service.id);
    if (!deployment || deployment.workerName !== service.stagingName || deployment.config !== service.config
      || deployment.deployOrder !== service.deployOrder || deployment.message !== expectedSha
      || !VERSION_ID.test(String(deployment.deploymentId ?? ""))
      || !VERSION_ID.test(String(deployment.versionId ?? ""))) {
      fail(`staging receipt does not prove ${service.id} at ${expectedSha}`);
    }
  }
  return receipt;
}

export function createStagingReceipt({ releaseSha, deployments, verifiedAt = new Date().toISOString() }) {
  const receipt = {
    schemaVersion: 1,
    kind: "noxhere.staging-verification",
    environment: "staging",
    origin: platformServices.origins.staging,
    releaseSha: assertSha(releaseSha),
    verifiedAt,
    checks: [...REQUIRED_STAGING_CHECKS],
    deployments,
  };
  return validateStagingReceipt(receipt, releaseSha, Date.parse(verifiedAt));
}

export function createRollbackManifest({ releaseSha, stagingReceipt, deployments, capturedAt = new Date().toISOString() }) {
  validateStagingReceipt(stagingReceipt, releaseSha, Date.parse(capturedAt));
  const manifest = {
    schemaVersion: 1,
    kind: "noxhere.production-rollback",
    environment: "production",
    promotionSha: assertSha(releaseSha),
    previousReleaseSha: deployments.find(({ serviceId }) => serviceId === "gateway")?.message ?? null,
    capturedAt,
    services: deployments,
  };
  return validateRollbackManifest(manifest, releaseSha, Date.parse(capturedAt));
}

export function validateRollbackManifest(manifest, expectedSha, now = Date.now()) {
  assertSha(expectedSha);
  if (manifest?.schemaVersion !== 1 || manifest?.kind !== "noxhere.production-rollback") fail("invalid rollback manifest");
  if (manifest.environment !== "production") fail("rollback manifest is not for production");
  if (manifest.promotionSha !== expectedSha) fail("rollback manifest belongs to another promotion");
  const age = now - isoDate(manifest.capturedAt, "rollback capture time");
  if (age < -60_000 || age > ROLLBACK_MAX_AGE_MS) fail("rollback manifest is stale");
  if (!Array.isArray(manifest.services) || manifest.services.length !== platformServices.services.length) {
    fail("rollback manifest does not cover every service");
  }
  for (const service of platformServices.services) {
    const target = manifest.services.find(({ serviceId }) => serviceId === service.id);
    if (!target || target.workerName !== service.productionName || target.config !== service.config
      || target.deployOrder !== service.deployOrder || !VERSION_ID.test(String(target.versionId ?? ""))) {
      fail(`rollback target for ${service.id} is invalid`);
    }
  }
  return manifest;
}

export async function verifyReleaseHealth(origin, expectedSha, fetchImpl = fetch) {
  const get = async (path) => {
    const response = await fetchImpl(new URL(path, origin), {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) fail(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
    return body;
  };
  const [platform, readiness, contracts] = await Promise.all([
    get("/__noxhere/health"),
    get("/api/health/ready"),
    get("/__noxhere/health/contracts"),
  ]);
  if (platform?.status !== "ok" || platform?.service !== "noxhere" || platform?.plane !== "public-platform") {
    fail("gateway liveness is not healthy");
  }
  const requiredChecks = [
    "database", "backgroundWorker", "deliveryQueue", "connections",
    "planning", "feedback", "telemetry", "activity", "scheduler",
  ];
  if (readiness?.status !== "ok" || requiredChecks.some((check) => readiness?.checks?.[check] !== true)) {
    fail("ecosystem readiness is not healthy");
  }
  for (const component of ["noxhere", "background", "connections", "planning", "feedback", "telemetry", "activity", "scheduler"]) {
    if (readiness?.versions?.[component] !== expectedSha) fail(`${component} readiness does not match ${expectedSha}`);
  }
  validateHealthContracts(contracts, expectedSha);
  return { platform, readiness, contracts };
}

export function rollbackToManifest(manifest, expectedSha, {
  runJson = runWranglerJson,
  runCommand = (args) => execFileSync(wrangler, args, { cwd: root, stdio: "inherit" }),
  now = Date.now(),
} = {}) {
  validateRollbackManifest(manifest, expectedSha, now);
  const failures = [];
  const results = [];
  const targets = [...manifest.services].sort((left, right) => right.deployOrder - left.deployOrder);
  for (const target of targets) {
    try {
      const envArgs = environmentArgs("production");
      const current = activeDeployment(
        platformServices.services.find(({ id }) => id === target.serviceId),
        "production",
        runJson(["deployments", "status", "--config", target.config, ...envArgs, "--json"]),
      );
      if (current.versionId !== target.versionId) {
        runCommand([
          "rollback", target.versionId, "--config", target.config, ...envArgs,
          "--message", `Automated rollback after failed promotion ${expectedSha}`, "--yes",
        ]);
      }
      const restored = activeDeployment(
        platformServices.services.find(({ id }) => id === target.serviceId),
        "production",
        runJson(["deployments", "status", "--config", target.config, ...envArgs, "--json"]),
      );
      if (restored.versionId !== target.versionId) fail(`${target.workerName} did not restore ${target.versionId}`);
      results.push({ serviceId: target.serviceId, versionId: target.versionId, restored: current.versionId !== target.versionId });
    } catch (error) {
      failures.push(`${target.serviceId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) fail(`rollback was incomplete:\n${failures.join("\n")}`);
  return results;
}

function assertWorkflowContract() {
  const workflow = readFileSync(resolve(root, ".github/workflows/deploy-pages.yml"), "utf8");
  const ordered = [
    "Synchronize staging internal authorization secret",
    "Deploy staging Connections capability",
    "Verify production-shaped staging login and scope",
    "Record verified staging release",
    "Capture production rollback targets",
    "Migrate production platform database",
    "Deploy production Connections capability",
    "Smoke production release",
    "Finalize verified production release",
    "Roll back failed production promotion",
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const index = workflow.indexOf(marker);
    if (index < 0) fail(`deployment workflow is missing: ${marker}`);
    if (index <= cursor) fail(`deployment workflow orders ${marker} incorrectly`);
    cursor = index;
  }
  for (const fragment of [
    "promote-verified-release.mjs record-staging",
    "promote-verified-release.mjs capture-rollback",
    "promote-verified-release.mjs finalize",
    "promote-verified-release.mjs rollback",
    "failure() && steps.authorize_production.outcome == 'success'",
  ]) {
    if (!workflow.includes(fragment)) fail(`deployment workflow is missing release guard: ${fragment}`);
  }
}

export function checkPromotionContract() {
  if (platformServices.services.at(-1)?.id !== "gateway") fail("gateway must be promoted last");
  if (new Set(platformServices.services.map(({ deployOrder }) => deployOrder)).size !== platformServices.services.length) {
    fail("service deployment order is not unique");
  }
  assertWorkflowContract();
  return true;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === "--check") {
    checkPromotionContract();
    process.stdout.write("Verified staging promotion and rollback contract is current.\n");
    return;
  }
  const command = args[0];
  const releaseSha = option(args, "--sha");
  assertSha(releaseSha);
  if (command === "record-staging") {
    const output = option(args, "--output");
    await verifyReleaseHealth(platformServices.origins.staging, releaseSha);
    const deployments = collectActiveDeployments({ environment: "staging", expectedSha: releaseSha });
    const receipt = createStagingReceipt({ releaseSha, deployments });
    writeJson(output, receipt);
    process.stdout.write(`${JSON.stringify({ status: "verified", environment: "staging", releaseSha, services: deployments.length })}\n`);
    return;
  }
  if (command === "capture-rollback") {
    const receipt = readJson(option(args, "--receipt"), "staging receipt");
    const output = option(args, "--output");
    validateStagingReceipt(receipt, releaseSha);
    const deployments = collectActiveDeployments({ environment: "production", inspectVersion: true });
    const manifest = createRollbackManifest({ releaseSha, stagingReceipt: receipt, deployments });
    writeJson(output, manifest);
    process.stdout.write(`${JSON.stringify({ status: "authorized", releaseSha, rollbackReleaseSha: manifest.previousReleaseSha, services: deployments.length })}\n`);
    return;
  }
  if (command === "finalize") {
    const receipt = readJson(option(args, "--receipt"), "staging receipt");
    const manifest = readJson(option(args, "--rollback-manifest"), "rollback manifest");
    const output = option(args, "--output");
    validateStagingReceipt(receipt, releaseSha);
    validateRollbackManifest(manifest, releaseSha);
    await verifyReleaseHealth(platformServices.origins.production, releaseSha);
    const deployments = collectActiveDeployments({ environment: "production", expectedSha: releaseSha });
    writeJson(output, {
      schemaVersion: 1,
      kind: "noxhere.production-promotion",
      releaseSha,
      promotedAt: new Date().toISOString(),
      stagingReceipt: receipt,
      rollbackManifest: manifest,
      deployments,
    });
    process.stdout.write(`${JSON.stringify({ status: "promoted", releaseSha, services: deployments.length })}\n`);
    return;
  }
  if (command === "rollback") {
    const manifest = readJson(option(args, "--manifest"), "rollback manifest");
    const results = rollbackToManifest(manifest, releaseSha);
    process.stdout.write(`${JSON.stringify({ status: "rolled_back", failedReleaseSha: releaseSha, services: results })}\n`);
    return;
  }
  fail("usage: promote-verified-release.mjs --check | record-staging|capture-rollback|finalize|rollback --sha <sha> ...");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
