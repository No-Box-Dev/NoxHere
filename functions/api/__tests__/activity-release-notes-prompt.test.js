import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/activity-response.js", () => ({
  getActivityDefaultPrompt: vi.fn(),
}));

import { onRequestGet } from "../activity/release-notes-prompt.js";
import { getActivityDefaultPrompt } from "../../lib/activity-response.js";

function context({ isAdmin = true } = {}) {
  return {
    env: { ACTIVITY_RESPONSE: {} },
    data: { orgId: 1, isAdmin },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("GET /api/activity/release-notes-prompt", () => {
  it("returns the complete built-in release-notes prompt to an admin", async () => {
    getActivityDefaultPrompt.mockResolvedValue("Full internal release-notes base prompt");

    const response = await onRequestGet(context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ prompt: "Full internal release-notes base prompt" });
    expect(getActivityDefaultPrompt).toHaveBeenCalledWith(expect.anything(), "release_notes");
  });

  it("explains that organization admin access is required", async () => {
    const response = await onRequestGet(context({ isAdmin: false }));

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/organization admin/i);
  });

  it("returns an actionable message when the Activity service is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getActivityDefaultPrompt.mockRejectedValue(new Error("binding unavailable"));

    const response = await onRequestGet(context());

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/Refresh and try again/i);
  });
});
