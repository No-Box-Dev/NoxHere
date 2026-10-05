import { describe, expect, it } from "vitest";
import { NOXFEED_SERVICE_MANIFEST, validateNoxFeedConfigPatch } from "./service.js";

describe("NoxFeed service contract", () => {
  it("owns its capability manifest", () => {
    expect(NOXFEED_SERVICE_MANIFEST.service.id).toBe("noxfeed");
    expect(NOXFEED_SERVICE_MANIFEST.configuration.writableFields).toEqual(["releaseNotesPrompt"]);
  });

  it("validates and normalizes its config patch", () => {
    expect(validateNoxFeedConfigPatch({ releaseNotesPrompt: null }, { releaseNotesPrompt: "Keep it concise" }))
      .toMatchObject({ valid: true, patch: { releaseNotesPrompt: "Keep it concise" } });
    expect(validateNoxFeedConfigPatch({}, { projectScope: null })).toMatchObject({ valid: false });
    expect(validateNoxFeedConfigPatch({}, { providerToken: "no" })).toMatchObject({ valid: false });
  });
});
