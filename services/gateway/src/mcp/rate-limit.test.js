import { afterEach, expect, test, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMcpRateLimit, MCP_RATE_POLICY } from "./rate-limit.ts";
import { handleMcp, PROTOCOL_VERSION } from "./mcp.ts";
import contract from "./noxhere-contract.json" with { type: "json" };

const migration = readFileSync(new URL("../../migrations/0006_mcp_rate_limits.sql", import.meta.url), "utf8");
const resources = [];
const now = 1_800_000_000_000;
const context = { credentialType: "api_token", credentialId: "fixture-token", orgId: 7,
  projectId: "fixture-project", orgLogin: "fixture-org", scopes: ["services:read", "planning:read", "activity:read", "feedback:read", "issues:read"] };
function wrap(sqlite) {
  // Control only SQLite's clock in fixtures; the actual production SQL is used.
  sqlite.function("strftime", (format, clock) => {
    if (format !== "%s" || clock !== "now") throw new Error("Unexpected clock expression");
    return String(Math.floor(Date.now() / 1000));
  });
  return {
    prepare(sql) { return { bind(...values) { return { sql, values }; } }; },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map(({ sql, values }) => {
          const statement = sqlite.prepare(sql);
          if (statement.columns().length) return { success: true, results: statement.all(...values) };
          statement.run(...values);
          return { success: true, results: [] };
        });
        sqlite.exec("COMMIT");
        return result;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
}
function database() {
  vi.spyOn(Date, "now").mockReturnValue(now);
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  resources.push(() => sqlite.close());
  return { sqlite, db: wrap(sqlite) };
}
function request(ip = "192.0.2.1", method = "tools/list", args = {}) {
  return new Request("https://example.test/mcp", {
    method: "POST", headers: {
      ...(ip ? { "CF-Connecting-IP": ip } : {}),
      Authorization: "Bearer nox_sk_rate_fixture_only", "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": method, ...(args.name ? { "Mcp-Name": args.name } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...args, _meta: {
      "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
      "io.modelcontextprotocol/clientCapabilities": {},
    } } }),
  });
}
afterEach(() => { resources.splice(0).reverse().forEach((close) => close()); vi.restoreAllMocks(); });

test("applies the append-only migration and admits exactly the IP budget", async () => {
  const { db, sqlite } = database();
  sqlite.exec(migration);
  const responses = await Promise.all(Array.from({ length: 150 }, () => checkMcpRateLimit(db, request())));
  expect(responses.filter((value) => value === null)).toHaveLength(120);
  expect(responses.filter((value) => value?.status === 429)).toHaveLength(30);
  expect(responses.find(Boolean).headers.get("Retry-After")).toBe("60");
  const row = sqlite.prepare("SELECT * FROM mcp_rate_limits").get();
  expect(row.request_count).toBe(121);
  expect(row.rate_key).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(row)).not.toMatch(/192\.0\.2|nox_sk|fixture/);
});

test("uses atomic counters across two SQLite connections sharing one database", async () => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  const directory = mkdtempSync(join(tmpdir(), "mcp-rate-"));
  resources.push(() => rmSync(directory, { recursive: true, force: true }));
  const left = new DatabaseSync(join(directory, "control.sqlite"));
  const right = new DatabaseSync(join(directory, "control.sqlite"));
  resources.push(() => left.close(), () => right.close());
  left.exec(migration);
  const clients = [wrap(left), wrap(right)];
  const results = await Promise.all(Array.from({ length: 100 }, (_, index) => checkMcpRateLimit(clients[index % 2], request(), context)));
  expect(results.filter((value) => value === null)).toHaveLength(60);
  expect(results.filter((value) => value?.status === 429)).toHaveLength(40);
  expect(left.prepare("SELECT request_count FROM mcp_rate_limits ORDER BY request_count").all().map((row) => row.request_count)).toEqual([61, 100]);
});

test("aggregates projects across tokens and separates organizations", async () => {
  const { db } = database();
  for (let i = 0; i < 120; i++) expect(await checkMcpRateLimit(db, request(), { ...context, credentialId: `token-${i}` })).toBeNull();
  expect((await checkMcpRateLimit(db, request(), { ...context, credentialId: "another-token" })).status).toBe(429);
  expect(await checkMcpRateLimit(db, request(), { ...context, orgId: 8 })).toBeNull();
  expect(await checkMcpRateLimit(db, request(), { ...context, projectId: "another-project", credentialId: "different-token" })).toBeNull();
});

test("resets the fixed window exactly at its boundary", async () => {
  const { db } = database();
  for (let i = 0; i < 61; i++) await checkMcpRateLimit(db, request(), context);
  vi.mocked(Date.now).mockReturnValue(now + 59_001);
  expect((await checkMcpRateLimit(db, request(), context)).headers.get("Retry-After")).toBe("1");
  vi.mocked(Date.now).mockReturnValue(now + 60_000);
  expect(await checkMcpRateLimit(db, request(), context)).toBeNull();
});

test("never resets counters backwards if the database clock moves back", async () => {
  const { db, sqlite } = database();
  for (let i = 0; i < 60; i++) await checkMcpRateLimit(db, request(), context);
  vi.mocked(Date.now).mockReturnValue(now - 60_000);
  expect((await checkMcpRateLimit(db, request(), context)).status).toBe(503);
  expect(sqlite.prepare("SELECT MIN(window_start) AS start FROM mcp_rate_limits").get().start).toBe(now);
  vi.mocked(Date.now).mockReturnValue(now);
  expect((await checkMcpRateLimit(db, request(), context)).status).toBe(429);
});

test("cleans at most 100 expired rows per pre-auth request without deleting active counters", async () => {
  const { db, sqlite } = database();
  const insert = sqlite.prepare("INSERT INTO mcp_rate_limits VALUES (?, ?, 1, ?)");
  for (let i = 0; i < 101; i++) insert.run(i.toString(16).padStart(64, "0"), now - MCP_RATE_POLICY.retentionMs, now);
  insert.run("f".repeat(64), now, now + MCP_RATE_POLICY.retentionMs);
  expect(await checkMcpRateLimit(db, request())).toBeNull();
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM mcp_rate_limits WHERE expires_at <= ?").get(now).count).toBe(1);
  expect(sqlite.prepare("SELECT * FROM mcp_rate_limits WHERE rate_key = ?").get("f".repeat(64))).toBeTruthy();
  expect(await checkMcpRateLimit(db, request())).toBeNull();
  expect(sqlite.prepare("SELECT COUNT(*) AS count FROM mcp_rate_limits WHERE expires_at <= ?").get(now).count).toBe(0);
});

test("fails closed for missing schema, failed batches and malformed results without leaking errors", async () => {
  const { db, sqlite } = database();
  sqlite.exec("DROP TABLE mcp_rate_limits");
  const missing = await checkMcpRateLimit(db, request());
  expect(missing.status).toBe(503);
  expect(await missing.text()).not.toMatch(/table|SQL|fixture/);
  for (const results of [[], [{ success: false }], [{ success: true, results: [] }, { success: true, results: [] }]]) {
    expect((await checkMcpRateLimit({ ...db, batch: async () => results }, request())).status).toBe(503);
  }
});

test("requires trusted ingress and authenticated identifiers, not caller scope headers", async () => {
  const { db } = database();
  expect((await checkMcpRateLimit(db, request(null))).status).toBe(503);
  for (const override of [{ orgId: undefined }, { orgId: 0 }, { credentialId: null }, { projectId: "" }]) {
    expect((await checkMcpRateLimit(db, request(), { ...context, ...override })).status).toBe(503);
  }
  const forged = request();
  forged.headers.set("X-Forwarded-For", "192.0.2.9");
  forged.headers.set("X-Org", "other");
  forged.headers.set("X-Project-ID", "other");
  for (let i = 0; i < 60; i++) expect(await checkMcpRateLimit(db, forged, context)).toBeNull();
  expect((await checkMcpRateLimit(db, request(), context)).status).toBe(429);
});

test("native adapter counts discovery, rejects all eleven tools at exhaustion, and never dispatches", async () => {
  const { db } = database();
  const deps = {
    authenticate: vi.fn(async () => ({ context })), dispatch: vi.fn(),
    rateLimit: (read, auth) => checkMcpRateLimit(db, read, auth),
  };
  for (let i = 0; i < 60; i++) expect((await handleMcp(request("192.0.2.1", i % 2 ? "tools/list" : "server/discover"), deps)).status).toBe(200);
  for (const op of contract.operations) {
    const args = Object.fromEntries((op.inputSchema.required ?? []).map((key) => [key, op.inputSchema.properties[key].type === "integer" ? 1 : "fixture"]));
    const response = await handleMcp(request("192.0.2.1", "tools/call", { name: op.name, arguments: args }), deps);
    expect(response.status, op.name).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  }
  expect(deps.dispatch).not.toHaveBeenCalled();
});

test("IP rejection precedes authentication and absent limiter cannot bypass admission", async () => {
  const { db } = database();
  for (let i = 0; i < 120; i++) await checkMcpRateLimit(db, request());
  const deps = { authenticate: vi.fn(), dispatch: vi.fn(), rateLimit: (read, auth) => checkMcpRateLimit(db, read, auth) };
  expect((await handleMcp(request(), deps)).status).toBe(429);
  expect(deps.authenticate).not.toHaveBeenCalled();
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect((await handleMcp(request(), { ...deps, rateLimit: undefined })).status).toBe(503);
});
