import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../github-app.js", () => ({
  getInstallationIdForOrg: vi.fn(async () => 42),
  getInstallationToken: vi.fn(async () => "token"),
}));
vi.mock("../github-sync.js", () => ({ upsertIssue: vi.fn(async () => undefined) }));
vi.mock("../transport-outbox", () => ({
  publishGitHubTransport: vi.fn(async () => ({ outboxId: "github-delivery-1", status: "queued", queued: true })),
  publishSlackTransport: vi.fn(async () => ({ outboxId: "delivery-1", status: "queued", queued: true })),
}));
vi.mock("../feedback-response.js", () => ({
  getFeedbackIssueResponse: vi.fn(async (_env, capture) => {
    const marker = `<!-- feedback:${capture.captureId} -->`;
    const reporter = capture.reporterGithubLogin
      ? `\n- **Reporter:** @${capture.reporterGithubLogin}`
      : capture.reporter ? `\n- **Reporter:** ${capture.reporter}` : "";
    const typeLabel = capture.issueType === "error" ? "error"
      : capture.issueType === "feature" ? "enhancement"
        : capture.issueType === "feedback" ? "feedback" : "bug";
    return {
      contract: "feedback.response",
      version: 1,
      idempotencyMarker: marker,
      issue: {
        title: capture.title,
        body: `${capture.title}${reporter}\n\n${marker}`,
        labels: [
          { name: "feedback", color: "FE795D", description: "Captured with Feedback" },
          { name: typeLabel, color: "D73A4A", description: "Capture type" },
        ],
      },
    };
  }),
  getFeedbackSlackResponse: vi.fn(async (_env, capture, issue) => ({
    contract: "feedback.response",
    version: 1,
    message: {
      text: `New Feedback issue: ${capture.title}`,
      blocks: [
        { type: "section", fields: [{ type: "mrkdwn", text: `*Page*\n${capture.metadata?.url}` }] },
        { type: "actions", elements: [
          { type: "button", text: { type: "plain_text", text: "Open reported page" }, url: capture.metadata?.url },
          { type: "button", text: { type: "plain_text", text: "Open GitHub issue" }, url: issue.html_url },
        ] },
      ],
    },
  })),
}));
vi.mock("../slack.js", () => ({
  resolveSlackChannels: vi.fn(async () => ({
    fallbackChannelId: "", telemetryChannelId: "", activityChannelId: "", planningChannelId: "",
  })),
  resolveSlackRoute: vi.fn((channels, service, siteChannelId) => {
    if (service === "telemetry") return channels.telemetryChannelId || channels.fallbackChannelId || "";
    return siteChannelId || channels.fallbackChannelId || "";
  }),
  resolveSlackConnectionId: vi.fn((channels, service, siteConnectionId) => {
    if (service === "feedback") return siteConnectionId || channels.fallbackConnectionId || "";
    if (service === "telemetry") return channels.telemetryConnectionId || channels.fallbackConnectionId || "";
    return channels.fallbackConnectionId || "";
  }),
}));

import { createFeedbackGitHubIssue, finalizeFeedbackGitHubIssue } from "../feedback.js";
import { publishGitHubTransport, publishSlackTransport } from "../transport-outbox";
import { resolveSlackChannels } from "../slack.js";

function db(site = {}) {
  const calls = [];
  const configuredSite = {
    site_name: "Website",
    repo: "web",
    project_id: "p1",
    slack_channel_id: null,
    slack_connection_id: null,
    owner_id: "acme",
    ...site,
  };
  return {
    _calls: calls,
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    prepare(sql) {
      const statement = {
        bind(...binds) { statement.binds = binds; return statement; },
        async first() { return sql.includes("FROM spot_sites site") ? configuredSite : null; },
        async run() { calls.push({ sql, binds: statement.binds }); return { success: true }; },
      };
      return statement;
    },
  };
}

const capture = {
  type: "spot_create_github_issue",
  captureId: "cap-1",
  deliveryId: "feedback:cap-1",
  orgId: 7,
  ownerId: "acme",
  projectId: "p1",
  repo: "web",
  siteId: "site-1",
  siteName: "Website",
  issueType: "bug",
  title: "Checkout is broken",
  description: "The submit button does nothing.",
  screenshotUrl: "https://cdn.example/shot.png",
  reporter: "Ada",
  metadata: { url: "https://app.example.com/checkout?cart=1", browser: "Chrome" },
};

async function finalizeLast(env, number = 12) {
  const payload = vi.mocked(publishGitHubTransport).mock.calls.at(-1)[1].callback.payload;
  return finalizeFeedbackGitHubIssue(env, {
    payload,
    receipt: {
      provider: "github", status: "delivered",
      result: { resourceType: "issue", resourceId: String(number), url: `https://github.com/acme/web/issues/${number}`, state: "open" },
    },
  });
}

describe("createFeedbackGitHubIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSlackChannels).mockResolvedValue({
      fallbackChannelId: "", telemetryChannelId: "", activityChannelId: "", planningChannelId: "",
    });
  });

  it("rejects unknown explicit capture contract versions", async () => {
    await expect(createFeedbackGitHubIssue({ DB: db() }, { ...capture, version: 2 }))
      .rejects.toThrow("Unsupported Feedback capture version: 2");
  });

  it("creates one labeled GitHub issue, mirrors it, and emits the feed event", async () => {
    const database = db();
    const env = { DB: database, TASK_QUEUE: { send: vi.fn() } };
    const result = await createFeedbackGitHubIssue(env, capture);

    expect(result).toEqual({ outboxId: "github-delivery-1", status: "queued", queued: true });
    expect(publishGitHubTransport).toHaveBeenCalledWith(env, expect.objectContaining({
      operation: "github.issue.create", route: "feedback", idempotencyKey: "feedback:cap-1",
      input: expect.objectContaining({ issue: expect.objectContaining({ title: capture.title }) }),
    }));
    await finalizeLast(env);
    const eventCall = database._calls.find((call) => call.sql.includes("INSERT INTO events"));
    expect(eventCall.sql).toContain("INSERT INTO events");
    expect(JSON.parse(eventCall.binds[6])).toMatchObject({
      githubIssueNumber: 12,
      githubIssueUrl: "https://github.com/acme/web/issues/12",
      siteId: "site-1",
      description: "The submit button does nothing.",
      reporter: "Ada",
      screenshotUrl: "https://cdn.example/shot.png",
    });
  });

  it("reuses an existing issue with the capture marker on a retry", async () => {
    await createFeedbackGitHubIssue({ DB: db() }, capture);
    expect(publishGitHubTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: "feedback:cap-1",
      input: expect.objectContaining({ idempotencyMarker: "<!-- feedback:cap-1 -->" }),
    }));
  });

  it("turns a tenant member selected as reporter into a GitHub mention", async () => {
    const database = db();
    const originalPrepare = database.prepare.bind(database);
    database.prepare = (sql) => {
      const statement = originalPrepare(sql);
      if (sql.includes("FROM members")) statement.first = async () => ({ login: "Ada-Lovelace" });
      return statement;
    };
    await createFeedbackGitHubIssue({ DB: database }, { ...capture, reporter: "@ada-lovelace" });

    const staged = vi.mocked(publishGitHubTransport).mock.calls.at(-1)[1];
    expect(staged.input.issue.body).toContain("**Reporter:** @Ada-Lovelace");
    expect(staged.callback.payload.reporterGithubLogin).toBe("Ada-Lovelace");
  });

  it("stages Slack separately after GitHub succeeds", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 14, title: capture.title, state: "open", body: "body",
          user: null, assignees: [], labels: [], created_at: "x", updated_at: "x",
          html_url: "https://github.com/acme/web/issues/14",
        }),
      });
    const database = db({ slack_channel_id: "C123", slack_connection_id: "conn-2" });
    const env = { DB: database, TASK_QUEUE: { send: vi.fn() } };
    await createFeedbackGitHubIssue(
      env,
      { ...capture, ownerId: "stale-owner", repo: "stale-repo", slackChannelId: "C-STALE", slackConnectionId: "conn-stale" },
    );
    await finalizeLast(env, 14);
    expect(publishSlackTransport).toHaveBeenCalledWith(expect.objectContaining({ DB: database }), expect.objectContaining({
      route: "feedback", routeContext: { kind: "site", id: "site-1" }, idempotencyKey: "feedback:cap-1",
    }));
    const stagedMessage = vi.mocked(publishSlackTransport).mock.calls.at(-1)[1].message;
    expect(stagedMessage.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "section",
        fields: expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining("https://app.example.com/checkout?cart=1") }),
        ]),
      }),
      expect.objectContaining({
        type: "actions",
        elements: expect.arrayContaining([
          expect.objectContaining({ text: expect.objectContaining({ text: "Open reported page" }), url: "https://app.example.com/checkout?cart=1" }),
        ]),
      }),
    ]));
    expect(vi.mocked(publishGitHubTransport).mock.calls.at(-1)[1].callback.payload.ownerId).toBe("acme");
  });

  it("keeps automatic errors on the configured Feedback site channel", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 15, title: capture.title, state: "open", body: "body",
          user: null, assignees: [], labels: [], created_at: "x", updated_at: "x",
          html_url: "https://github.com/acme/web/issues/15",
        }),
      });
    vi.mocked(resolveSlackChannels).mockResolvedValue({
      fallbackChannelId: "C-FALLBACK", telemetryChannelId: "C-CUE",
      activityChannelId: "", planningChannelId: "",
    });

    const env = { DB: db({ slack_channel_id: "C-SPOT" }), TASK_QUEUE: { send: vi.fn() } };
    await createFeedbackGitHubIssue(
      env,
      { ...capture, issueType: "error", slackChannelId: "C-SPOT" },
    );
    await finalizeLast(env, 15);

    expect(publishSlackTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      route: "feedback", routeContext: { kind: "site", id: "site-1" },
    }));
  });

  it("uses the organization fallback when a Feedback site has no channel", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 16, title: capture.title, state: "open", body: "body",
          user: null, assignees: [], labels: [], created_at: "x", updated_at: "x",
          html_url: "https://github.com/acme/web/issues/16",
        }),
      });
    vi.mocked(resolveSlackChannels).mockResolvedValue({
      fallbackChannelId: "C-FALLBACK", telemetryChannelId: "",
      activityChannelId: "", planningChannelId: "",
    });

    const env = { DB: db(), TASK_QUEUE: { send: vi.fn() } };
    await createFeedbackGitHubIssue(
      env,
      { ...capture, slackChannelId: null },
    );
    await finalizeLast(env, 16);

    expect(publishSlackTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      route: "feedback", routeContext: { kind: "site", id: "site-1" },
    }));
  });
});
