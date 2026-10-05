import { describe, expect, it, vi } from "vitest";

vi.mock("../slack/test.js", () => ({
  onRequestPost: vi.fn(async (context) => Response.json(await context.request.json())),
}));
vi.mock("../../lib/slack.js", async (importOriginal) => ({
  ...(await importOriginal()),
  resolveSlackInstall: vi.fn(async (_env, _orgId, connectionId) => ({ id: connectionId ?? "conn-default", botToken: "xoxb-test" })),
  getSlackChannel: vi.fn(async (_token, channelId) => ({ id: channelId, is_archived: false, is_private: false, is_member: true })),
}));

import { signOAuthState } from "../../lib/slack.js";
import { onRequestGet as slackHandoff } from "../slack/oauth/handoff.ts";
import { onRequestGet as getRouting, onRequestPatch as patchRouting } from "../integrations/slack/routing.ts";
import { onRequestPost as testRoute } from "../integrations/slack/test.ts";

function dbWithSettings(settings = {}, options = {}) {
  const configRows = [...(options.configRows ?? [{ data: JSON.stringify(settings) }])];
  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        bind: vi.fn((...binds) => {
          statement._binds = binds;
          return statement;
        }),
        first: vi.fn(async () => sql.includes("SELECT data FROM") ? (configRows.shift() ?? null) : null),
        all: vi.fn(async () => ({
          results: sql.includes("FROM slack_connections connection") ? (options.connectionRows ?? []) : [],
        })),
        run: vi.fn(async () => ({ success: true, meta: { changes: options.changes ?? 1 } })),
      };
      return statement;
    }),
    batch: vi.fn(async (statements) => {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    }),
  };
  return db;
}

describe("agent setup APIs", () => {
  it("turns a signed handoff into a cookie-setting Slack redirect", async () => {
    const payload = `nonce:7:alice:${Date.now()}`;
    const state = `${payload}.${await signOAuthState("secret", payload)}`;
    const response = await slackHandoff({
      request: new Request(`https://app.noxhere.com/api/slack/oauth/handoff?state=${encodeURIComponent(state)}`),
      env: { SLACK_CLIENT_ID: "client", SLACK_CLIENT_SECRET: "secret" },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("slack.com/oauth/v2/authorize");
    expect(response.headers.get("Set-Cookie")).toContain(`ut_slack_state=${state}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects an expired handoff", async () => {
    const payload = `nonce:7:alice:${Date.now() - 600_001}`;
    const state = `${payload}.${await signOAuthState("secret", payload)}`;
    const response = await slackHandoff({
      request: new Request(`https://app.noxhere.com/api/slack/oauth/handoff?state=${encodeURIComponent(state)}`),
      env: { SLACK_CLIENT_ID: "client", SLACK_CLIENT_SECRET: "secret" },
    });
    expect(response.status).toBe(400);
  });

  it("reads canonical Slack routes", async () => {
    const response = await getRouting({
      env: { DB: dbWithSettings({ slack: { fallbackChannelId: "C1", postsChannelId: "C2", noxTicketChannelId: "CT", noxTicketConnectionId: "conn-playnist" } }) },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
    });
    expect(await response.json()).toMatchObject({
      routes: { fallback: "C1", noxfeed_posts: "C2", noxticket: "CT", noxcue: null },
      connections: { noxticket: "conn-playnist" },
    });
  });

  it("reports a stored channel whose workspace connection is missing", async () => {
    const response = await getRouting({
      env: { DB: dbWithSettings({ slack: { noxTicketChannelId: "CT" } }) },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
    });
    expect(await response.json()).toMatchObject({
      integrity: {
        valid: false,
        issues: [{ route: "noxticket", code: "missing_workspace" }],
      },
    });
  });

  it("saves the NoxTicket channel together with its Slack workspace", async () => {
    const DB = dbWithSettings({ slack: {} });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH",
        body: JSON.stringify({ routes: { noxticket: "C-TICKET" }, connections: { noxticket: "conn-playnist" } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(200);
    const updateCall = DB.prepare.mock.calls.find(([sql]) => sql.includes("WHERE org_id = ? AND project_id = ? AND key = ? AND data = ?"));
    const updateStatement = DB.prepare.mock.results[DB.prepare.mock.calls.indexOf(updateCall)].value;
    expect(JSON.parse(updateStatement.bind.mock.calls[0][0])).toEqual({
      slack: { noxTicketChannelId: "C-TICKET", noxTicketConnectionId: "conn-playnist" },
    });
  });

  it("infers a legacy client's workspace from a verified channel pair", async () => {
    const DB = dbWithSettings({ slack: {} }, {
      connectionRows: [
        { id: "conn-default", project_id: null, is_default: 1, channel_status: null },
        { id: "conn-playnist", project_id: "project-1", is_default: 0, channel_status: "verified" },
      ],
    });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH",
        body: JSON.stringify({ routes: { noxticket: "C-TICKET" } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(200);
    const updateCall = DB.prepare.mock.calls.find(([sql]) => sql.includes("WHERE org_id = ? AND project_id = ? AND key = ? AND data = ?"));
    const updateStatement = DB.prepare.mock.results[DB.prepare.mock.calls.indexOf(updateCall)].value;
    expect(JSON.parse(updateStatement.bind.mock.calls[0][0]).slack).toEqual({
      noxTicketChannelId: "C-TICKET",
      noxTicketConnectionId: "conn-playnist",
    });
  });

  it("rejects an ambiguous legacy channel save instead of selecting the wrong workspace", async () => {
    const DB = dbWithSettings({ slack: {} }, {
      connectionRows: [
        { id: "conn-one", project_id: null, is_default: 1, channel_status: null },
        { id: "conn-two", project_id: null, is_default: 0, channel_status: null },
      ],
    });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH",
        body: JSON.stringify({ routes: { noxticket: "C-TICKET" } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Choose a Slack workspace for the noxticket channel. This organization has multiple Slack workspaces, so the channel alone is ambiguous.",
    });
    expect(DB.batch).not.toHaveBeenCalled();
  });

  it("reads organization-wide Slack routes when no project is selected", async () => {
    const DB = dbWithSettings({ slack: { postsChannelId: "C2" } });
    const response = await getRouting({
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: null, isAdmin: true },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ routes: { noxfeed_posts: "C2" } });
    expect(DB.prepare.mock.calls[0][0]).toContain("FROM config");
  });

  it("writes organization-wide Slack routes to legacy organization config", async () => {
    const DB = dbWithSettings({ slack: {} });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH", body: JSON.stringify({ routes: { noxfeed_posts: null } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: null, isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(200);
    expect(DB.prepare.mock.calls.some(([sql]) => sql.includes("UPDATE config SET"))).toBe(true);
    expect(DB.prepare.mock.calls.some(([sql]) => sql.includes("UPDATE delivery_outbox") && !sql.includes("project_id = ?"))).toBe(true);
  });

  it("rejects unknown route names without mutating config", async () => {
    const DB = dbWithSettings({});
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH", body: JSON.stringify({ routes: { surprise: "C1" } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(400);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("merges a routing patch with compare-and-swap and retires the combined NoxFeed route", async () => {
    const DB = dbWithSettings({ theme: "dark", slack: { noxFeedChannelId: "" } });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH", body: JSON.stringify({ routes: { noxfeed_posts: null } }),
      }),
      env: { DB },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
      params: {},
    });
    expect(response.status).toBe(200);
    expect(DB.batch).toHaveBeenCalledOnce();
    expect(DB.batch.mock.calls[0][0]).toHaveLength(7);
    const updateCall = DB.prepare.mock.calls.find(([sql]) => sql.includes("WHERE org_id = ? AND project_id = ? AND key = ? AND data = ?"));
    expect(updateCall).toBeTruthy();
    const dependentSql = DB.prepare.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.includes("UPDATE delivery_outbox"));
    expect(dependentSql).toHaveLength(6);
    expect(dependentSql.every((sql) => sql.includes("config_guard.key = ?") && sql.includes("config_guard.data = ?"))).toBe(true);
    const updateStatement = DB.prepare.mock.results[DB.prepare.mock.calls.indexOf(updateCall)].value;
    const serialized = updateStatement.bind.mock.calls[0][0];
    expect(JSON.parse(serialized)).toEqual({ theme: "dark", slack: { postsChannelId: "", postsConnectionId: "" } });
  });

  it("treats an identical compare-and-swap race as idempotent success", async () => {
    const oldSettings = { theme: "dark", slack: {} };
    const desiredSettings = { theme: "dark", slack: { postsChannelId: "", postsConnectionId: "" } };
    const DB = dbWithSettings(oldSettings, {
      changes: 0,
      configRows: [{ data: JSON.stringify(oldSettings) }, { data: JSON.stringify(desiredSettings) }],
    });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH", body: JSON.stringify({ routes: { noxfeed_posts: null } }),
      }),
      env: { DB }, data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true }, params: {},
    });
    expect(response.status).toBe(200);
  });

  it("returns 409 when compare-and-swap loses to a different value", async () => {
    const oldSettings = { theme: "dark", slack: {} };
    const DB = dbWithSettings(oldSettings, {
      changes: 0,
      configRows: [{ data: JSON.stringify(oldSettings) }, { data: JSON.stringify({ theme: "light", slack: {} }) }],
    });
    const response = await patchRouting({
      request: new Request("https://app.noxhere.com/api/integrations/slack/routing", {
        method: "PATCH", body: JSON.stringify({ routes: { noxfeed_posts: null } }),
      }),
      env: { DB }, data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true }, params: {},
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Settings changed concurrently; fetch routing and retry" });
  });

  it.each([
    ["fallback", "fallback"],
    ["noxcue", "noxcue"],
    ["noxticket", "noxticket"],
    ["noxfeed_posts", "noxfeed_posts"],
    ["noxfeed_release_notes", "noxfeed_release_notes"],
    ["noxfeed_daily_summary", "noxfeed_daily_summary"],
  ])("delegates the %s route using the legacy handler's accepted kind", async (route, kind) => {
    const response = await testRoute({
      request: new Request("https://app.noxhere.com/api/integrations/slack/test", {
        method: "POST", body: JSON.stringify({ route, channelId: "C1" }),
      }),
      env: { DB: dbWithSettings({}) },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ channelId: "C1", kind });
  });

  it("tests a saved NoxTicket route with its saved workspace connection", async () => {
    const response = await testRoute({
      request: new Request("https://app.noxhere.com/api/integrations/slack/test", {
        method: "POST", body: JSON.stringify({ route: "noxticket" }),
      }),
      env: { DB: dbWithSettings({ slack: { noxTicketChannelId: "C1", noxTicketConnectionId: "conn-playnist" } }) },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1", isAdmin: true },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connectionId: "conn-playnist", channelId: "C1", kind: "noxticket" });
  });
});
