import { describe, expect, it } from "vitest";
import { FEEDBACK_SERVICE_MANIFEST } from "../service-manifest";

describe("Feedback service manifest", () => {
  it("advertises the versioned private service contract", () => {
    expect(FEEDBACK_SERVICE_MANIFEST.contract).toBe("nox.service-manifest");
    expect(FEEDBACK_SERVICE_MANIFEST.version).toBe(1);
    expect(FEEDBACK_SERVICE_MANIFEST.service.id).toBe("feedback");
    expect(FEEDBACK_SERVICE_MANIFEST.service.capabilities.map(({ id }) => id)).toEqual([
      "sites", "widget", "reports", "feedback_delivery",
    ]);
  });
});
