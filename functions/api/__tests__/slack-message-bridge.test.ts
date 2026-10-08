import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/slack.js", () => ({
  actionableSlackError: vi.fn((error: { code?: string }, fallback: string) => error.code === "rate_limited" ? "Slack is temporarily rate-limiting requests. Wait a moment, then try again." : fallback),
  getSlackChannel: vi.fn(async () => ({ id: "C123", is_archived: false, is_private: false, is_member: true })),
  resolveSlackInstall: vi.fn(async () => ({ id: "conn-1", botToken: "xoxb-secret" })),
}));
vi.mock("../../lib/transports/slack", () => ({
  deliverResolvedSlackMessage: vi.fn(async () => ({ channelId: "C123", messageId: "1730000000.123456" })),
}));

import { onRequestPost } from "../v1/integrations/slack/messages";
import { getSlackChannel, resolveSlackInstall } from "../../lib/slack.js";
import { deliverResolvedSlackMessage } from "../../lib/transports/slack";

function context(body: unknown, data: Record<string, unknown> = {}) {
  return {
    request: new Request("https://app.noxhere.com/api/v1/integrations/slack/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    data: { orgId: 7, projectId: "project-1", orgLogin: "acme", isAdmin: true, ...data },
    env: { DB: {} },
  } as never;
}

describe("Slack message bridge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a specific error when no channel is selected", async () => {
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "", message: { text: "Hello" } }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "slack_channel_required", message: "Choose a Slack channel before sending the message" } });
    expect(deliverResolvedSlackMessage).not.toHaveBeenCalled();
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
    expect(resolveSlackInstall).toHaveBeenCalledWith(expect.anything(), 7, "conn-1");
    expect(getSlackChannel).toHaveBeenCalledWith("xoxb-secret", "C123");
    expect(deliverResolvedSlackMessage).toHaveBeenCalledWith(expect.anything(), {
      orgId: 7,
      connectionId: "conn-1",
      channelId: "C123",
      message,
    });
  });

  it("explains how to make a private channel available", async () => {
    vi.mocked(getSlackChannel).mockResolvedValueOnce({ id: "G123", is_archived: false, is_private: true, is_member: false } as never);
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "G123", message: { text: "Hello" } }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "slack_channel_membership_required", message: expect.stringContaining("Invite @NoxConnect") } });
  });

  it("requires an administrator and an active Slack installation", async () => {
    const forbidden = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }, { isAdmin: false }));
    expect(forbidden.status).toBe(403);

    vi.mocked(resolveSlackInstall).mockResolvedValueOnce(null);
    const disconnected = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }));
    expect(disconnected.status).toBe(409);
    expect(await disconnected.json()).toMatchObject({ error: { code: "slack_not_connected" } });
  });

  it("rejects a Slack workspace assigned to another project", async () => {
    vi.mocked(resolveSlackInstall).mockResolvedValueOnce({
      id: "conn-other",
      projectId: "project-2",
      botToken: "xoxb-secret",
    } as never);
    const response = await onRequestPost(context({
      connectionId: "conn-other",
      channelId: "C123",
      message: { text: "Hello" },
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "slack_workspace_project_mismatch" } });
    expect(deliverResolvedSlackMessage).not.toHaveBeenCalled();
  });

  it("returns Slack rate limits as actionable 429 errors", async () => {
    vi.mocked(deliverResolvedSlackMessage).mockRejectedValueOnce(Object.assign(new Error("rate_limited"), { code: "rate_limited" }));
    const response = await onRequestPost(context({ connectionId: "conn-1", channelId: "C123", message: { text: "Hello" } }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "rate_limited", message: expect.stringContaining("rate-limiting") } });
  });
});
