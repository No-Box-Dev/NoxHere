import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/slack.js", () => ({
  actionableSlackError: vi.fn((_error, fallback) => fallback),
}));

import { onRequestPost } from "../slack/test.js";
import { actionableSlackError } from "../../lib/slack.js";

function context(body) {
  const calls = [];
  const checkSlackOrgHealth = vi.fn(async () => ({ status: "ok", recovered: false }));
  const sendSlackMessage = vi.fn(async ({ connectionId, channelId }) => ({
    ok: true,
    result: { connectionId, channelId, messageId: "1.2" },
  }));
  return {
    request: new Request("https://app.noxhere.com/api/slack/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
    env: {
      CONNECTIONS: { checkSlackOrgHealth, sendSlackMessage },
      TELEMETRY_RESPONSE: {
        buildTestResponse: vi.fn(async (org) => ({ contract: "telemetry.response", version: 1, message: { text: `Telemetry delivery test for ${org}`, blocks: [{ type: "section" }] } })),
      },
      FEEDBACK_RESPONSE: {
        buildIssueResponse: vi.fn(),
        buildSlackResponse: vi.fn(),
        buildTestResponse: vi.fn(async (org) => ({ contract: "feedback.response", version: 1, message: { text: `Feedback delivery test for ${org}`, blocks: [{ type: "section" }] } })),
        buildDailyDigestResponse: vi.fn(async (name, period, filed, solved, totals) => ({
          contract: "feedback.response", version: 1,
          message: { text: `${name} ${period}: ${totals.filed} filed, ${totals.solved} solved`, blocks: [{ type: "section" }] },
        })),
      },
      ACTIVITY_RESPONSE: {
        buildPrompt: vi.fn(),
        buildSlackResponse: vi.fn(),
        buildTestResponse: vi.fn(async (org, stream) => ({
          contract: "activity.response",
          version: 1,
          message: {
            text: `Activity ${stream === "posts" ? "posts" : stream === "release_notes" ? "release notes" : "delivery"} delivery test for ${org}`.replace("delivery delivery", "delivery"),
            blocks: [{ type: "section" }],
          },
        })),
      },
      DB: {
        batch: async () => [
          { results: [{ count: 0 }] }, { results: [] },
          { results: [{ count: 0 }] }, { results: [] }, { results: [] },
        ],
        prepare: (sql) => ({
          bind: (...binds) => ({
            first: async () => sql.includes("FROM spot_sites site") ? {
              id: "site-playnist", org_id: 7, project_id: "project-1", repo: "playnist", name: "Playnist",
              widget_config: JSON.stringify({ dailySummaryEnabled: true }),
              slack_channel_id: "C-ALERT", slack_connection_id: "conn-2", owner_id: "acme",
            } : null,
            run: async () => { calls.push({ sql, binds }); return { success: true }; },
          }),
        }),
      },
    },
    calls,
    checkSlackOrgHealth,
    sendSlackMessage,
  };
}

describe("Slack route tests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the Telemetry-specific payload to the selected channel", async () => {
    const ctx = context({ kind: "telemetry", connectionId: "conn-2", channelId: "C-ALERT" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      connectionId: "conn-2",
      channelId: "C-ALERT",
      messageTs: "1.2",
    });
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      projectId: "project-1",
      connectionId: "conn-2",
      channelId: "C-ALERT",
      message: expect.objectContaining({ text: "Telemetry delivery test for acme" }),
    }));
  });

  it("sends a dedicated Telemetry alert-route test", async () => {
    const ctx = context({ kind: "telemetry_alerts", connectionId: "conn-2", channelId: "C-ALERT" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({ text: "Telemetry alert delivery test for acme" }),
    }));
  });

  it("sends the real Feedback daily-summary format for a selected site", async () => {
    const ctx = context({
      kind: "feedback", sourceId: "site-playnist", connectionId: "conn-2", channelId: "C-ALERT",
    });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({ text: expect.stringMatching(/^Playnist — test \d{4}-\d{2}-\d{2}: 0 filed, 0 solved$/) }),
    }));
  });

  it("marks a bad receipt as an issue and the next accepted message as verified", async () => {
    const failed = context({ kind: "telemetry", connectionId: "conn-2", channelId: "C-ALERT" });
    failed.sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "slack_delivery_failed", message: "wrong channel" },
    });
    expect((await onRequestPost(failed)).status).toBe(502);
    expect(failed.calls.some((call) => call.sql.includes("INSERT INTO slack_channel_status")
      && call.sql.includes("'issue'"))).toBe(true);

    const recovered = context({ kind: "telemetry", connectionId: "conn-2", channelId: "C-ALERT" });
    expect((await onRequestPost(recovered)).status).toBe(200);
    expect(recovered.calls.some((call) => call.sql.includes("INSERT INTO slack_channel_status")
      && call.sql.includes("'verified'"))).toBe(true);
  });

  it("returns invite guidance from the credential-owning service", async () => {
    const ctx = context({ kind: "planning", connectionId: "conn-2", channelId: "C-ALERT" });
    ctx.sendSlackMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: "slack_channel_membership_required", message: "invite the bot" },
    });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(409);
    expect(actionableSlackError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "slack_channel_membership_required" }),
      expect.any(String),
    );
  });

  it("does not silently reinterpret an unknown test as Activity", async () => {
    const ctx = context({ kind: "wrong", connectionId: "conn-2", channelId: "C-OTHER" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(400);
    expect(ctx.sendSlackMessage).not.toHaveBeenCalled();
  });

  it("verifies one workspace connection and posts a real test message", async () => {
    const ctx = context({ kind: "connection", connectionId: "conn-2", channelId: "C-ALERT" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(ctx.checkSlackOrgHealth).toHaveBeenCalledWith(7, "conn-2");
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({ text: "NoxHere workspace test for acme" }),
    }));
    expect(ctx.calls.some((call) => call.sql.includes("INSERT INTO slack_channel_status")
      && call.binds.includes("C-ALERT"))).toBe(true);
  });

  it.each([
    ["activity_posts", "Activity posts delivery test for acme"],
    ["activity_release_notes", "Activity release notes delivery test for acme"],
  ])("sends a distinct %s test payload", async (kind, text) => {
    const ctx = context({ kind, connectionId: "conn-2", channelId: "C-FEED" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({ text }),
    }));
  });

  it("sends a dedicated daily-summary test payload", async () => {
    const ctx = context({ kind: "activity_daily_summary", connectionId: "conn-2", channelId: "C-SUMMARY" });
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(200);
    expect(ctx.sendSlackMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({ text: "Activity daily summary delivery test for acme" }),
    }));
  });
});
