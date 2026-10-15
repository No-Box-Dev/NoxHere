import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../functions/lib/slack.js", () => ({
  resolveSlackInstall: vi.fn(),
  getSlackChannel: vi.fn(),
}));

import { getSlackChannel, resolveSlackInstall } from "../../../functions/lib/slack.js";
import { validateSlackDestination } from "./slack-destination";

const input = {
  orgId: 7,
  projectId: "proj-playnist",
  connectionId: "conn-1",
  channelId: "C123",
};

describe("Connections Slack destination validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSlackInstall).mockResolvedValue({
      id: "conn-1",
      projectId: "proj-playnist",
      botToken: "xoxb-secret",
    } as never);
    vi.mocked(getSlackChannel).mockResolvedValue({
      id: "C123",
      is_archived: false,
      is_private: false,
      is_member: true,
    } as never);
  });

  it("validates with the credential-owning Worker and returns no token", async () => {
    const result = await validateSlackDestination({ DB: {} as D1Database, ENCRYPTION_KEY: "secret" }, input);
    expect(result).toEqual({ ok: true, result: { connectionId: "conn-1" } });
    expect(JSON.stringify(result)).not.toContain("xoxb-secret");
    expect(getSlackChannel).toHaveBeenCalledWith("xoxb-secret", "C123");
  });

  it("rejects malformed input before reading credentials", async () => {
    const result = await validateSlackDestination({ DB: {} as D1Database }, { ...input, channelId: "" });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_request", status: 400 } });
    expect(resolveSlackInstall).not.toHaveBeenCalled();
  });

  it("rejects a workspace assigned to another project", async () => {
    vi.mocked(resolveSlackInstall).mockResolvedValue({
      id: "conn-1",
      projectId: "proj-other",
      botToken: "xoxb-secret",
    } as never);
    const result = await validateSlackDestination({ DB: {} as D1Database }, input);
    expect(result).toMatchObject({ ok: false, error: { code: "slack_workspace_project_mismatch", status: 409 } });
    expect(getSlackChannel).not.toHaveBeenCalled();
  });

  it("rejects archived and inaccessible private channels", async () => {
    vi.mocked(getSlackChannel).mockResolvedValueOnce({ id: "C123", is_archived: true } as never);
    await expect(validateSlackDestination({ DB: {} as D1Database }, input)).resolves.toMatchObject({
      ok: false,
      error: { code: "slack_channel_unavailable", status: 409 },
    });

    vi.mocked(getSlackChannel).mockResolvedValueOnce({
      id: "C123",
      is_archived: false,
      is_private: true,
      is_member: false,
    } as never);
    await expect(validateSlackDestination({ DB: {} as D1Database }, input)).resolves.toMatchObject({
      ok: false,
      error: { code: "slack_channel_membership_required", status: 409 },
    });
  });

  it("reports provider failures as retryable service unavailability", async () => {
    vi.mocked(getSlackChannel).mockRejectedValue(new Error("timeout"));
    await expect(validateSlackDestination({ DB: {} as D1Database }, input)).resolves.toEqual({
      ok: false,
      error: {
        code: "slack_validation_unavailable",
        message: "Slack channel validation is temporarily unavailable",
        status: 503,
      },
    });
  });
});
