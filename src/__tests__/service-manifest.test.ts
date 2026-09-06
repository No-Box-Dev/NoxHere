import { describe, expect, it } from "vitest";
import { NOXCUE_SERVICE_MANIFEST } from "../service-manifest";

describe("NoxCue service manifest", () => {
  it("advertises the incident capability owned by NoxCue", () => {
    expect(NOXCUE_SERVICE_MANIFEST).toMatchObject({
      contract: "nox.service-manifest",
      version: 1,
      service: { id: "noxcue", kind: "product" },
      configuration: { mode: "resource", writable: false },
    });
    expect(NOXCUE_SERVICE_MANIFEST.service.capabilities.map((item) => item.id)).toContain("github_incidents");
  });
});
