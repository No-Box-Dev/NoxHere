import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  projectRoute: vi.fn(),
  channels: vi.fn(),
  channel: vi.fn(),
  connection: vi.fn(),
  install: vi.fn(),
  reconnect: vi.fn(),
  post: vi.fn(),
  update: vi.fn(),
  verified: vi.fn(),
  channelIssue: vi.fn(),
}));

vi.mock("../project-routing", () => ({ resolveProjectSlackDestination: provider.projectRoute }));
vi.mock("../slack.js", () => ({
  resolveSlackChannels: provider.channels,
  resolveSlackRoute: provider.channel,
  resolveSlackConnectionId: provider.connection,
  resolveSlackInstall: provider.install,
  slackInstallNeedsReconnect: provider.reconnect,
  postSlackMessage: provider.post,
  updateSlackMessage: provider.update,
}));
vi.mock("../slack-channel-status.js", () => ({
  markSlackChannelVerified: provider.verified,
  markSlackChannelIssue: provider.channelIssue,
}));

import { deliverSlackTransport } from "../transports/slack";
import { parseTransportCommand } from "../../../packages/contracts/transport-commands";

function command(operation: "slack.message.send" | "slack.message.update" = "slack.message.send", clientMessageId?: string) {
  return parseTransportCommand({
    contract: "platform.transport-command" as const,
    version: 1 as const,
    commandId: "cmd-1",
    idempotencyKey: "activity:1",
    orgId: 7,
    projectId: "project-1",
    route: "activity" as const,
    requestedAt: "2026-10-04T00:00:00.000Z",
    operation,
    input: operation === "slack.message.update"
      ? { messageId: "100.2", message: { text: "updated", blocks: [] } }
      : { message: { text: "hello", ...(clientMessageId ? { client_msg_id: clientMessageId } : {}), blocks: [] } },
  });
}

describe("Slack transport adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.projectRoute.mockResolvedValue({ connectionId: "connection-1", channelId: "C123" });
    provider.install.mockResolvedValue({ botToken: "xoxb-secret" });
    provider.reconnect.mockReturnValue(false);
    provider.post.mockResolvedValue({ channel: "C123", ts: "100.1" });
    provider.update.mockResolvedValue({ channel: "C123", ts: "100.2" });
  });

  it("resolves a neutral route and sends without producer-owned destinations", async () => {
    await expect(deliverSlackTransport({ DB: {} as D1Database }, command())).resolves.toEqual({
      channelId: "C123",
      messageId: "100.1",
    });
    expect(provider.projectRoute).toHaveBeenCalledWith({}, 7, "noxfeed_posts", { projectId: "project-1" });
    expect(provider.post).toHaveBeenCalledWith("xoxb-secret", "C123", { text: "hello", blocks: [] });
  });

  it("uses the same adapter for updates", async () => {
    await deliverSlackTransport({ DB: {} as D1Database }, command("slack.message.update"));
    expect(provider.update).toHaveBeenCalledWith("xoxb-secret", "C123", "100.2", { text: "updated", blocks: [] });
  });

  it("passes the producer idempotency identifier to Slack", async () => {
    await deliverSlackTransport({ DB: {} as D1Database }, command("slack.message.send", "capture-1"));
    expect(provider.post).toHaveBeenCalledWith("xoxb-secret", "C123", {
      text: "hello",
      client_msg_id: "capture-1",
      blocks: [],
    });
  });

  it("resolves a site-scoped feedback route inside the adapter", async () => {
    const statement = {
      bind: vi.fn(),
      first: vi.fn(async () => ({ connection_id: "connection-site", channel_id: "C-SPOT" })),
    };
    statement.bind.mockReturnValue(statement);
    const DB = { prepare: vi.fn(() => statement) } as unknown as D1Database;
    provider.post.mockResolvedValueOnce({ channel: "C-SPOT", ts: "100.3" });
    const feedback = parseTransportCommand({
      ...command(),
      commandId: "feedback-1",
      idempotencyKey: "noxspot:capture-1",
      route: "feedback",
      routeContext: { kind: "site", id: "site-1" },
    });
    await expect(deliverSlackTransport({ DB }, feedback)).resolves.toMatchObject({ channelId: "C-SPOT" });
    expect(statement.bind).toHaveBeenCalledWith("site-1", 7, "project-1");
    expect(provider.install).toHaveBeenCalledWith(expect.anything(), 7, "connection-site");
  });

  it("blocks a command when its neutral route has no destination", async () => {
    provider.projectRoute.mockResolvedValue(null);
    provider.channels.mockResolvedValue({});
    provider.channel.mockReturnValue("");
    provider.connection.mockReturnValue("");
    await expect(deliverSlackTransport({ DB: {} as D1Database }, command())).rejects.toMatchObject({
      code: "slack_route_not_configured",
      disposition: "blocked",
    });
  });

  it("classifies rate limits as retryable", async () => {
    provider.post.mockRejectedValue(Object.assign(new Error("slow down"), { code: "rate_limited", status: 429 }));
    await expect(deliverSlackTransport({ DB: {} as D1Database }, command())).rejects.toMatchObject({
      code: "rate_limited",
      disposition: "retryable",
    });
  });

  it("never exposes a Slack token in its receipt", async () => {
    const receipt = await deliverSlackTransport({ DB: {} as D1Database }, command());
    expect(JSON.stringify(receipt)).not.toContain("xoxb-secret");
  });
});
