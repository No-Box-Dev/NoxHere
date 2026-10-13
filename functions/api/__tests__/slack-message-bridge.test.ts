import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/slack.js", () => ({
  actionableSlackError: vi.fn((error: { code?: string }, fallback: string) => error.code === "rate_limited" ? "Slack is temporarily rate-limiting requests. Wait a moment, then try again." : fallback),
}));

import { onRequestPost } from "../v1/integrations/slack/messages";

const sendSlackMessage = vi.fn(async () => ({
  ok: true,
  result: { connectionId: "conn-1", channelId: "C123", messageId: "1730000000.123456" },
}));

function context(body: unknown, data: Record<string, unknown> = {}) {
  return {
    request: new Request("https://app.noxhere.com/api/v1/integrations/slack/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    data: { orgId: 7, projectId: "project-1", orgLogin: "acme", isAdmin: true, ...data },
    env: { DB: {}, NOXHERE_EMAIL: { sendSlackMessage } },
  } as never;
}

describe("Slack message bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSlackMessage.mockResolvedValue({
      ok: true,
      result: { connectionId: "conn-1", channelId: "C123", messageId: "1730000000.123456" },
    });
  });

  it("returns a specific error when no channel is selected", async () => {
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "", message: { text: "Hello" } }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "slack_channel_required", message: "Choose a Slack channel before sending the message" } });
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("validates native Slack fields before delivery", async () => {
    const response = await onRequestPost(context({
      connectionId: "conn-1",
      channelId: "C123",
      message: { text: "Hello", unsupported: true },
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "validation_failed" } });
  });

  it("sends text, image blocks, attachments, and delivery options through the selected connection", async () => {
    const message = {
      text: "Release ready",
      blocks: [{ type: "image", image_url: "https://example.com/release.png", alt_text: "Release graph" }],
      attachments: [{ color: "#2eb67d", text: "Production" }],
      unfurl_links: false,
      thread_ts: "1730000000.100000",
      reply_broadcast: true,
    };
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      apiVersion: 1,
      delivery: { status: "sent", connectionId: "conn-1", channelId: "C123", messageTs: "1730000000.123456" },
    });
    expect(sendSlackMessage).toHaveBeenCalledWith({
      orgId: 7,
      projectId: "project-1",
      connectionId: "conn-1",
      channelId: "C123",
      message,
    });
  });

  it("explains how to make a private channel available", async () => {
    sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "slack_channel_membership_required", message: "NoxHere is not a member of the private Slack channel" },
    } as never);
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "G123", message: { text: "Hello" } }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "slack_channel_membership_required", message: expect.stringContaining("Invite @NoxHere") } });
  });

  it("requires an administrator for interactive requests", async () => {
    const forbidden = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }, { isAdmin: false }));
    expect(forbidden.status).toBe(403);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("allows a project-scoped API token admitted by the slack:send gateway", async () => {
    const response = await onRequestPost(context(
      { connectionId: "conn-1", channelId: "C123", message: { text: "Nightly complete" } },
      { isAdmin: false, auth: { type: "api_token" } },
    ));

    expect(response.status).toBe(201);
    expect(sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      projectId: "project-1",
      connectionId: "conn-1",
      channelId: "C123",
    }));
  });

  it("requires an active Slack installation", async () => {

    sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "slack_not_connected", message: "Slack is not connected" },
    } as never);
    const disconnected = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }));
    expect(disconnected.status).toBe(409);
    expect(await disconnected.json()).toMatchObject({ error: { code: "slack_not_connected" } });
  });

  it("rejects a Slack workspace assigned to another project", async () => {
    sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "slack_workspace_project_mismatch", message: "The selected Slack workspace belongs to another project" },
    } as never);
    const response = await onRequestPost(context({
      connectionId: "conn-other",
      channelId: "C123",
      message: { text: "Hello" },
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "slack_workspace_project_mismatch" } });
    expect(sendSlackMessage).toHaveBeenCalledOnce();
  });

  it("returns Slack rate limits as actionable 429 errors", async () => {
    sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "rate_limited", message: "rate_limited" },
    } as never);
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "rate_limited", message: expect.stringContaining("rate-limiting") } });
  });
});
