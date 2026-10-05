import { describe, expect, it } from "vitest";
import { NOXCUE_SERVICE_MANIFEST } from "../service-manifest";

describe("Cue service manifest", () => {
  it("publishes a complete versioned service contract", () => {
    expect(NOXCUE_SERVICE_MANIFEST).toMatchObject({
      contract: "nox.service-manifest",
      version: 1,
      service: { id: "noxcue", name: "Incidents" },
    });
    const capabilityIds = new Set(NOXCUE_SERVICE_MANIFEST.service.capabilities.map(({ id }) => id));
    for (const section of NOXCUE_SERVICE_MANIFEST.service.setupSections) {
      expect(section.capabilityIds.every((id) => capabilityIds.has(id))).toBe(true);
    }
  });
});
