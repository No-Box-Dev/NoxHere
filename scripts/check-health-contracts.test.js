import { describe, expect, it } from "vitest";
import { HEALTH_SERVICES, validateHealthContracts, verifyStaticCoverage } from "./check-health-contracts.mjs";

const sha = "a".repeat(40);

function contract(overrides = {}) {
  return {
    contractVersion: 1,
    kind: "health-contracts",
    status: "ok",
    buildSha: sha,
    services: HEALTH_SERVICES.map((service) => ({ service, live: true, ready: true, buildSha: sha })),
    ...overrides,
  };
}

describe("health contract gate", () => {
  it("covers every deployed service in source and configuration", () => {
    expect(verifyStaticCoverage()).toEqual({ services: 8 });
  });

  it("accepts only a complete exact-release deployment", () => {
    expect(validateHealthContracts(contract(), sha).services).toHaveLength(8);
    expect(() => validateHealthContracts(contract({
      services: contract().services.map((service) => service.service === "activity" ? { ...service, ready: false } : service),
    }), sha)).toThrow("activity is not ready");
    expect(() => validateHealthContracts(contract({ services: contract().services.slice(1) }), sha)).toThrow("connections is missing");
    expect(() => validateHealthContracts(contract(), "b".repeat(40))).toThrow("aggregate release");
  });
});
