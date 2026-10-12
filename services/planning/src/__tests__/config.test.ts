import { describe, expect, it } from "vitest";
import { validateConfigPatch } from "../config";
import { PLANNING_MANIFEST } from "../manifest";

const current = {
  featureRepository: "noxhere",
  workflow: { stages: [{ id: "backlog", label: "Backlog", color: "#112233" }] },
};

describe("Planning service contract", () => {
  it("publishes the versioned product manifest", () => {
    expect(PLANNING_MANIFEST).toMatchObject({ contract: "nox.service-manifest", version: 1, service: { id: "planning" } });
  });

  it("normalizes valid configuration patches", () => {
    expect(validateConfigPatch(current, { featureRepository: "  delivery  " })).toMatchObject({
      valid: true,
      patch: { featureRepository: "delivery" },
      config: { featureRepository: "delivery" },
    });
  });

  it("rejects duplicate workflow stage ids", () => {
    const response = validateConfigPatch(current, { workflow: { stages: [
      { id: "doing", label: "Doing", color: "#112233" },
      { id: "doing", label: "Also doing", color: "#445566" },
    ] } });
    expect(response).toMatchObject({ valid: false });
  });
});
