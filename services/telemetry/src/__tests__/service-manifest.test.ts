import { describe, expect, it } from "vitest";
import { TELEMETRY_SERVICE_MANIFEST } from "../service-manifest";

describe("Telemetry service manifest", () => {
  it("publishes a complete versioned service contract", () => {
    expect(TELEMETRY_SERVICE_MANIFEST).toMatchObject({
      contract: "nox.service-manifest",
      version: 1,
      service: { id: "telemetry", name: "Incidents" },
    });
    const capabilityIds = new Set(TELEMETRY_SERVICE_MANIFEST.service.capabilities.map(({ id }) => id));
    for (const section of TELEMETRY_SERVICE_MANIFEST.service.setupSections) {
      expect(section.capabilityIds.every((id) => capabilityIds.has(id))).toBe(true);
    }
  });
});
