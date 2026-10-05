import { describe, expect, it } from "vitest";
import { projectPlatformEvent, projectionModel, shouldReplaceProjection } from "../platform-event-projector";

const row = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  spec_version: 1, data_version: 1, type: "feedback.report.created",
  org_id: 7, project_id: "project-1", source_component: "feedback.capture", source_id: "site-1",
  subject_type: "feedback.report", subject_id: "report-1", actor_type: "anonymous", actor_id: null,
  context_json: null, message_json: JSON.stringify({ title: "Checkout is broken" }),
  data_json: JSON.stringify({ category: "bug", description: "Submit does nothing", notificationRequested: false }),
  idempotency_key: "report-1:create", correlation_id: "report-1", causation_id: null,
  occurred_at: "2026-10-04T10:00:00.000Z",
};

class FakeDb {
  claim = true;
  statements: Array<{ sql: string; values: unknown[] }> = [];
  batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  prepare(sql: string) {
    const record = { sql, values: [] as unknown[] };
    const statement = {
      _record: record,
      bind: (...values: unknown[]) => { record.values = values; return statement; },
      first: async () => {
        this.statements.push(record);
        if (!sql.includes("UPDATE platform_events") || !sql.includes("RETURNING") || !this.claim) return null;
        this.claim = false;
        return row;
      },
      run: async () => { this.statements.push(record); return { meta: { changes: 1 } }; },
    };
    return statement;
  }
  async batch(statements: Array<{ _record: { sql: string; values: unknown[] } }>) {
    this.batches.push(statements.map((statement) => statement._record));
    return [];
  }
}

describe("platform event projector", () => {
  it("routes every event family to one bounded read model", () => {
    expect(projectionModel("source_control.pull_request.opened")).toBe("activity");
    expect(projectionModel("reliability.incident.opened")).toBe("reliability");
    expect(projectionModel("engagement.user.active")).toBe("engagement");
    expect(projectionModel("feedback.report.created")).toBe("feedback");
    expect(projectionModel("delivery.notification.delivered")).toBe("delivery");
  });

  it("uses event time and event ID to reject out-of-order state rewinds", () => {
    const current = { lastOccurredAt: "2026-10-04T11:00:00.000Z", lastEventId: "b" };
    expect(shouldReplaceProjection(current, { occurredAt: "2026-10-04T10:00:00.000Z", id: "z" })).toBe(false);
    expect(shouldReplaceProjection(current, { occurredAt: "2026-10-04T11:00:00.000Z", id: "a" })).toBe(false);
    expect(shouldReplaceProjection(current, { occurredAt: "2026-10-04T11:00:00.000Z", id: "c" })).toBe(true);
  });

  it("atomically inserts an idempotent fact, guarded current state, and completion", async () => {
    const db = new FakeDb();
    await expect(projectPlatformEvent(db as unknown as D1Database, row.id, new Date("2026-10-04T12:00:00Z")))
      .resolves.toMatchObject({ projected: true, model: "feedback" });
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][0].sql).toContain("ON CONFLICT(event_id) DO NOTHING");
    expect(db.batches[0][1].sql).toContain("excluded.last_occurred_at >");
    expect(db.batches[0][2].sql).toContain("projection_status = 'projected'");
  });

  it("does not project the same claimed event twice", async () => {
    const db = new FakeDb();
    await projectPlatformEvent(db as unknown as D1Database, row.id);
    await expect(projectPlatformEvent(db as unknown as D1Database, row.id)).resolves.toEqual({ skipped: "not_claimable" });
    expect(db.batches).toHaveLength(1);
  });
});
