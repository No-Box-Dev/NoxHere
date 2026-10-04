import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishPlatformEvent, recoverPlatformEventProjections } from "../platform-event-store";

const EVENT = {
  specVersion: 1,
  dataVersion: 1,
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: "feedback.report.created",
  orgId: 7,
  projectId: "project-1",
  source: { component: "capture_worker", sourceId: "site-1" },
  subject: { type: "feedback_report", id: "report-1" },
  actor: { type: "anonymous", idHash: `sha256:${"a".repeat(64)}` },
  context: { environment: "production" },
  message: { title: "Checkout is broken", severity: "warning" },
  occurredAt: "2026-10-04T10:15:00Z",
  idempotencyKey: "capture:report-1",
  correlationId: "report-1",
  data: { category: "bug", description: "Pay does not respond", notificationRequested: true },
};

interface FakeOptions {
  insert?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown> | null;
  idConflict?: boolean;
  recovery?: Array<{ id: string; org_id: number; project_id: string }>;
}

class FakeDatabase {
  calls: Array<{ sql: string; values: unknown[]; method: string }> = [];

  constructor(private readonly options: FakeOptions = {}) {}

  prepare(sql: string) {
    const values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => {
        values.push(...input);
        return statement;
      },
      first: async <T>() => {
        this.calls.push({ sql, values: [...values], method: "first" });
        if (sql.includes("INSERT INTO platform_events")) return (this.options.insert ?? null) as T | null;
        if (sql.includes("source_component = ?")) return (this.options.duplicate ?? null) as T | null;
        if (sql.includes("WHERE id = ? LIMIT 1")) return (this.options.idConflict ? { id: values[0] } : null) as T | null;
        return null;
      },
      run: async () => {
        this.calls.push({ sql, values: [...values], method: "run" });
        return { meta: { changes: 1 } };
      },
      all: async <T>() => {
        this.calls.push({ sql, values: [...values], method: "all" });
        return { results: (this.options.recovery ?? []) as T[] };
      },
    };
    return statement;
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT.id,
    org_id: 7,
    project_id: "project-1",
    type: EVENT.type,
    projection_status: "pending",
    received_at: "2026-10-04T10:16:00.000Z",
    ...overrides,
  };
}

function environment(database: FakeDatabase, send = vi.fn().mockResolvedValue(undefined)) {
  return {
    env: { DB: database as unknown as D1Database, TASK_QUEUE: { send } as unknown as Queue },
    send,
  };
}

describe("canonical platform event persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates, persists, and queues a new event", async () => {
    const database = new FakeDatabase({ insert: row() });
    const { env, send } = environment(database);
    const result = await publishPlatformEvent(env, EVENT, new Date("2026-10-04T10:16:00Z"));

    expect(result).toMatchObject({ duplicate: false, queued: true, event: { id: EVENT.id, projectionStatus: "queued" } });
    expect(send).toHaveBeenCalledWith({
      type: "project_platform_event",
      eventId: EVENT.id,
      orgId: 7,
      projectId: "project-1",
      deliveryId: EVENT.id,
    });
    const insert = database.calls.find((call) => call.sql.includes("INSERT INTO platform_events"));
    expect(insert?.sql).toContain("FROM projects project");
    expect(insert?.values).toContain(JSON.stringify(EVENT.data));
    expect(database.calls.some((call) => call.sql.includes("projection_status = 'queued'"))).toBe(true);
  });

  it("returns the original row for a duplicate producer key without queueing it twice", async () => {
    const database = new FakeDatabase({ duplicate: row({ projection_status: "queued" }) });
    const { env, send } = environment(database);
    const result = await publishPlatformEvent(env, { ...EVENT, id: "8f4497e7-73c8-4e40-8c77-4497580a7046" });

    expect(result).toMatchObject({ duplicate: true, queued: false, event: { id: EVENT.id } });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps a persisted event pending when Queue publication fails", async () => {
    const database = new FakeDatabase({ insert: row() });
    const { env } = environment(database, vi.fn().mockRejectedValue(new Error("Queue unavailable")));
    const result = await publishPlatformEvent(env, EVENT, new Date("2026-10-04T10:16:00Z"));

    expect(result).toMatchObject({ duplicate: false, queued: false, event: { projectionStatus: "pending" } });
    const failure = database.calls.find((call) => call.sql.includes("last_error = ?"));
    expect(failure?.values[0]).toBe("Queue unavailable");
  });

  it("rejects a project outside the event organization", async () => {
    const database = new FakeDatabase();
    const { env } = environment(database);
    await expect(publishPlatformEvent(env, EVENT)).rejects.toThrow("platform_event_project_scope_invalid");
  });

  it("distinguishes an event-id collision from an idempotent duplicate", async () => {
    const database = new FakeDatabase({ idConflict: true });
    const { env } = environment(database);
    await expect(publishPlatformEvent(env, EVENT)).rejects.toThrow("platform_event_id_conflict");
  });

  it("recovers pending, failed, and stale projection work through the same Queue message", async () => {
    const database = new FakeDatabase({
      recovery: [
        { id: "event-1", org_id: 7, project_id: "project-1" },
        { id: "event-2", org_id: 7, project_id: "project-1" },
      ],
    });
    const { env, send } = environment(database);
    const result = await recoverPlatformEventProjections(env, {
      limit: 25,
      now: new Date("2026-10-04T11:00:00Z"),
    });

    expect(result).toEqual({ found: 2, queued: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(database.calls[0].sql).toContain("stale_projection_claim");
    const select = database.calls.find((call) => call.method === "all");
    expect(select?.values).toEqual([25]);
  });

  it("bounds recovery batches", async () => {
    const database = new FakeDatabase();
    const { env } = environment(database);
    await recoverPlatformEventProjections(env, { limit: 5_000 });
    const select = database.calls.find((call) => call.method === "all");
    expect(select?.values).toEqual([500]);
  });
});
