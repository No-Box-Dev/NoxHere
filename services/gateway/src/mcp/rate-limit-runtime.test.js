import { expect, test } from "vitest";
import { getPlatformProxy } from "wrangler";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMcpRateLimit } from "./rate-limit.ts";

test("counts concurrent attempts atomically through an actual local D1 binding", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mcp-d1-runtime-"));
  const configPath = join(directory, "wrangler.json");
  writeFileSync(configPath, JSON.stringify({
    name: "mcp-local-fixture", compatibility_date: "2026-10-01",
    d1_databases: [{ binding: "CONTROL_DB", database_name: "mcp-local-fixture", database_id: "00000000-0000-0000-0000-000000000000" }],
  }));
  let proxy;
  try {
    proxy = await getPlatformProxy({ configPath, envFiles: [], remoteBindings: false, persist: false });
    const db = proxy.env.CONTROL_DB;
    const migration = readFileSync(new URL("../../migrations/0006_mcp_rate_limits.sql", import.meta.url), "utf8");
    for (const sql of migration.replace(/--[^\n]*/g, "").split(";").filter((part) => part.trim())) {
      await db.prepare(sql).run();
    }
    const receipts = [];
    const observedDb = {
      prepare: (sql) => db.prepare(sql),
      async batch(statements) { const results = await db.batch(statements); receipts.push(results); return results; },
    };
    const context = { credentialType: "api_token", credentialId: "local-token", orgId: 7,
      projectId: "local-project", orgLogin: "local-org", scopes: ["services:read"] };
    const results = await Promise.all(Array.from({ length: 20 }, () => checkMcpRateLimit(observedDb, new Request("https://fixture.invalid/mcp"), context)));
    expect(results.every((result) => result === null)).toBe(true);
    // Group by the authoritative database window so a minute boundary does not
    // make the test flaky. Each budget must have a gap-free unique increment.
    for (const index of [0, 1]) {
      const windows = new Map();
      for (const batch of receipts) {
        const row = batch[index].results[0];
        if (!windows.has(row.window_start)) windows.set(row.window_start, []);
        windows.get(row.window_start).push(row.request_count);
      }
      for (const counts of windows.values()) expect(counts.sort((a, b) => a - b)).toEqual(Array.from({ length: counts.length }, (_, i) => i + 1));
    }
    await db.prepare("DROP TABLE mcp_rate_limits").run();
    expect((await checkMcpRateLimit(db, new Request("https://fixture.invalid/mcp"), context)).status).toBe(503);
  } finally {
    await proxy?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
