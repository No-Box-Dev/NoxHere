import { describe, expect, it } from "vitest";
import { ACTIVITY_SERVICE_MANIFEST, validateActivityConfigPatch } from "./service.js";

describe("Activity service contract", () => {
  it("owns its capability manifest", () => {
    expect(ACTIVITY_SERVICE_MANIFEST.service.id).toBe("activity");
    expect(ACTIVITY_SERVICE_MANIFEST.configuration.writableFields).toEqual(["releaseNotesPrompt"]);
  });

  it("validates and normalizes its config patch", () => {
    expect(validateActivityConfigPatch({ releaseNotesPrompt: null }, { releaseNotesPrompt: "Keep it concise" }))
      .toMatchObject({ valid: true, patch: { releaseNotesPrompt: "Keep it concise" } });
    expect(validateActivityConfigPatch({}, { projectScope: null })).toMatchObject({ valid: false });
    expect(validateActivityConfigPatch({}, { providerToken: "no" })).toMatchObject({ valid: false });
  });
});
