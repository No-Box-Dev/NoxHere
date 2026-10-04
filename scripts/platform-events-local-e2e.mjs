#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "vite";

class LocalStatement {
  values = [];
  constructor(database, sql) { this.database = database; this.sql = sql; }
  bind(...values) { this.values = values; return this; }
  first() { return this.database.statement(this.sql).get(...this.values) ?? null; }
  run() {
    const result = this.database.statement(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  all() { return { success: true, results: this.database.statement(this.sql).all(...this.values) }; }
}

class LocalD1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); this.sqlite.exec("PRAGMA foreign_keys = ON"); }
  statement(sql) { return this.sqlite.prepare(sql); }
  prepare(sql) { return new LocalStatement(this, sql); }
  exec(sql) { this.sqlite.exec(sql); return { count: 1, duration: 0 }; }
  batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((item) => {
        const prepared = this.statement(item.sql);
        return prepared.columns().length ? { results: prepared.all(...item.values), success: true }
          : { ...item.run(), results: [] };
      });
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  close() { this.sqlite.close(); }
}

function migration(name) { return readFileSync(resolve("migrations", name), "utf8"); }

async function main() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const db = new LocalD1();
  try {
    const [{ publishPlatformEvent }, { projectPlatformEvent }, transport, { recoverTransportDeliveryEvents }] = await Promise.all([
      vite.ssrLoadModule("/functions/lib/platform-event-store.ts"),
      vite.ssrLoadModule("/functions/lib/platform-event-projector.ts"),
      vite.ssrLoadModule("/functions/lib/transport-outbox.ts"),
      vite.ssrLoadModule("/functions/lib/transport-delivery-events.ts"),
    ]);
    db.exec(`
      CREATE TABLE orgs (id INTEGER PRIMARY KEY, github_login TEXT NOT NULL UNIQUE);
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, repo TEXT, owner_id TEXT, org_id INTEGER NOT NULL REFERENCES orgs(id));
      INSERT INTO orgs (id, github_login) VALUES (7, 'acme');
      INSERT INTO projects (id, name, repo, owner_id, org_id) VALUES ('project-1', 'Checkout', 'checkout', 'acme', 7);
    `);
    db.exec(migration("0100_platform_events.sql"));
    db.exec(migration("0101_transport_outbox.sql"));
    db.exec(migration("0103_transport_callbacks.sql"));
    db.exec(migration("0104_platform_event_projections.sql"));

    const queued = [];
    const env = { DB: db, TASK_QUEUE: { send: async (message) => { queued.push(message); } } };
    const eventId = "550e8400-e29b-41d4-a716-446655440000";
    const eventPublication = await publishPlatformEvent(env, {
      specVersion: 1, dataVersion: 1, id: eventId, type: "feedback.report.created",
      orgId: 7, projectId: "project-1", source: { component: "feedback.capture", sourceId: "site-1" },
      subject: { type: "feedback.report", id: "report-1" }, actor: { type: "anonymous" },
      message: { title: "Checkout feedback" }, occurredAt: "2026-10-04T10:00:00Z",
      idempotencyKey: "report-1:create",
      data: { category: "bug", description: "Checkout cannot submit", notificationRequested: false },
    }, new Date("2026-10-04T10:00:01Z"));
    assert.equal(eventPublication.queued, true);
    assert.equal(queued[0].type, "project_platform_event");
    await projectPlatformEvent(db, eventId, new Date("2026-10-04T10:00:02Z"));
    assert.equal((await db.prepare("SELECT state FROM platform_projection_state WHERE subject_id = 'report-1'").first()).state, "open");

    const staged = await transport.publishGitHubTransport(env, {
      orgId: 7, projectId: "project-1", route: "feedback", idempotencyKey: "report-1:github",
      operation: "github.issue.create",
      input: { issue: { title: "Checkout feedback", body: "Checkout cannot submit", labels: [] } },
      callback: { kind: "noxspot_issue", payload: { captureId: "report-1" } },
      requestedAt: new Date("2026-10-04T10:01:00Z"),
    });
    const receipt = await transport.executeTransportCommand(env, staged.outboxId, {
      slack: async () => { throw new Error("unexpected Slack command"); },
      github: async () => ({ resourceType: "issue", resourceId: "42", url: "https://github.com/acme/checkout/issues/42", state: "open" }),
    }, new Date("2026-10-04T10:01:01Z"));
    assert.equal(receipt.status, "delivered");
    let finalized = false;
    await transport.executeTransportCallback(db, staged.outboxId, {
      noxspot_issue: async ({ payload }) => { assert.equal(payload.captureId, "report-1"); finalized = true; },
      noxcue_incident: async () => { throw new Error("unexpected callback"); },
    }, new Date("2026-10-04T10:01:02Z"));
    assert.equal(finalized, true);

    assert.deepEqual(await recoverTransportDeliveryEvents(env), { found: 1, published: 2 });
    const lifecycle = await db.prepare("SELECT id FROM platform_events WHERE source_component = 'transport.outbox' ORDER BY occurred_at").all();
    assert.equal(lifecycle.results.length, 2);
    for (const row of lifecycle.results) await projectPlatformEvent(db, row.id, new Date("2026-10-04T10:02:00Z"));
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM platform_projection_events").first()).count, 3);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM transport_outbox WHERE status = 'delivered'").first()).count, 1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM transport_callbacks WHERE status = 'completed'").first()).count, 1);
    console.log("Unified local E2E passed: event → projection; command → receipt → callback; receipt → delivery events.");
  } finally {
    db.close();
    await vite.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
