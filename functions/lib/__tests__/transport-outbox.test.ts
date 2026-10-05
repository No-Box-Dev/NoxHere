import { describe, expect, it, vi } from "vitest";
import {
  TransportExecutionError,
  claimTransportCommand,
  executeTransportCallback,
  executeTransportCommand,
  publishTransportCommand,
  recoverTransportCommands,
} from "../transport-outbox";

const COMMAND = {
  contract: "platform.transport-command",
  version: 1,
  commandId: "command-1",
  idempotencyKey: "feedback:report-1:slack",
  causedByEventId: "550e8400-e29b-41d4-a716-446655440000",
  correlationId: "report-1",
  orgId: 7,
  projectId: "project-1",
  route: "feedback",
  requestedAt: "2026-10-04T10:16:00Z",
  operation: "slack.message.send",
  input: { message: { text: "New feedback", blocks: [] } },
};

interface Options {
  insert?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown> | null;
  idConflict?: boolean;
  claim?: Record<string, unknown> | null;
  recovery?: Array<{ id: string }>;
  callbackClaim?: { kind: "noxspot_issue" | "noxcue_incident"; payload_json: string };
  callbackTransport?: { command_json: string; receipt_json: string };
}

class FakeDatabase {
  calls: Array<{ sql: string; values: unknown[]; method: string }> = [];
  constructor(private readonly options: Options = {}) {}

  prepare(sql: string) {
    const values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => { values.push(...input); return statement; },
      first: async <T>() => {
        this.calls.push({ sql, values: [...values], method: "first" });
        if (sql.includes("INSERT INTO transport_outbox")) return (this.options.insert ?? null) as T | null;
        if (sql.includes("provider = ? AND operation")) return (this.options.duplicate ?? null) as T | null;
        if (sql.includes("SELECT id FROM transport_outbox")) return (this.options.idConflict ? { id: values[0] } : null) as T | null;
        if (sql.includes("UPDATE transport_outbox") && sql.includes("RETURNING")) return (this.options.claim ?? null) as T | null;
        if (sql.includes("UPDATE transport_callbacks") && sql.includes("RETURNING")) return (this.options.callbackClaim ?? null) as T | null;
        if (sql.includes("SELECT command_json, receipt_json")) return (this.options.callbackTransport ?? null) as T | null;
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

function outbox(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMAND.commandId,
    org_id: 7,
    project_id: "project-1",
    provider: "slack",
    operation: COMMAND.operation,
    idempotency_key: COMMAND.idempotencyKey,
    command_json: JSON.stringify(COMMAND),
    status: "pending",
    attempt_count: 0,
    max_attempts: 5,
    receipt_json: null,
    ...overrides,
  };
}

function environment(database: FakeDatabase, send = vi.fn().mockResolvedValue(undefined)) {
  return { env: { DB: database as unknown as D1Database, TASK_QUEUE: { send } as unknown as Queue }, send };
}

describe("provider-neutral transport outbox", () => {
  it("persists and queues a project-scoped command", async () => {
    const database = new FakeDatabase({ insert: outbox() });
    const { env, send } = environment(database);
    const result = await publishTransportCommand(env, COMMAND, new Date("2026-10-04T10:16:00Z"));
    expect(result).toEqual({ outboxId: "command-1", status: "queued", duplicate: false, queued: true });
    expect(send).toHaveBeenCalledWith({ type: "deliver_transport", outboxId: "command-1", deliveryId: "command-1" });
    const insert = database.calls.find((call) => call.sql.includes("INSERT INTO transport_outbox"));
    expect(insert?.sql).toContain("FROM projects project");
    expect(insert?.sql).toContain("FROM platform_events event");
  });

  it("returns an existing command for a duplicate idempotency key", async () => {
    const database = new FakeDatabase({ duplicate: outbox({ status: "delivered" }) });
    const { env, send } = environment(database);
    const result = await publishTransportCommand(env, { ...COMMAND, commandId: "command-2" });
    expect(result).toEqual({ outboxId: "command-1", status: "delivered", duplicate: true, queued: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects invalid project or source-event scope", async () => {
    const database = new FakeDatabase();
    const { env } = environment(database);
    await expect(publishTransportCommand(env, COMMAND)).rejects.toThrow("transport_command_scope_invalid");
  });

  it("claims a command atomically with a bounded lease", async () => {
    const database = new FakeDatabase({ claim: outbox({ status: "processing", attempt_count: 1 }) });
    const claimed = await claimTransportCommand(database as unknown as D1Database, "command-1", new Date("2026-10-04T10:20:00Z"));
    expect(claimed?.attempt_count).toBe(1);
    const claim = database.calls[0];
    expect(claim.sql).toContain("attempt_count = attempt_count + 1");
    expect(claim.values[0]).toBe("2026-10-04T10:25:00.000Z");
  });

  it("stores a normalized delivered receipt", async () => {
    const database = new FakeDatabase({ claim: outbox({ status: "processing", attempt_count: 1 }) });
    const receipt = await executeTransportCommand(
      { DB: database as unknown as D1Database },
      "command-1",
      {
        slack: vi.fn().mockResolvedValue({ channelId: "C123", messageId: "123.456" }),
        github: vi.fn(),
      },
      new Date("2026-10-04T10:20:00Z"),
    );
    expect(receipt).toMatchObject({ provider: "slack", status: "delivered", result: { messageId: "123.456" } });
    const finish = database.calls.find((call) => call.method === "run" && call.sql.includes("receipt_json"));
    expect(finish?.values[0]).toBe("delivered");
  });

  it("marks retryable failures and throws so Queue retry remains active", async () => {
    const database = new FakeDatabase({ claim: outbox({ status: "processing", attempt_count: 1 }) });
    await expect(executeTransportCommand(
      { DB: database as unknown as D1Database },
      "command-1",
      {
        slack: vi.fn().mockRejectedValue(new TransportExecutionError("Rate limited", "rate_limited", "retryable")),
        github: vi.fn(),
      },
      new Date("2026-10-04T10:20:00Z"),
    )).rejects.toThrow("Rate limited");
    const retry = database.calls.find((call) => call.method === "run" && call.sql.includes("status = 'retrying'"));
    expect(retry?.values[0]).toBe("2026-10-04T10:25:00.000Z");
  });

  it("records blocked and exhausted outcomes as terminal receipts", async () => {
    const blockedDb = new FakeDatabase({ claim: outbox({ status: "processing", attempt_count: 1 }) });
    const blocked = await executeTransportCommand(
      { DB: blockedDb as unknown as D1Database },
      "command-1",
      {
        slack: vi.fn().mockRejectedValue(new TransportExecutionError("No route", "route_missing", "blocked")),
        github: vi.fn(),
      },
    );
    expect(blocked).toMatchObject({ status: "blocked", error: { code: "route_missing", retryable: false } });

    const exhaustedDb = new FakeDatabase({ claim: outbox({ status: "processing", attempt_count: 5, max_attempts: 5 }) });
    const exhausted = await executeTransportCommand(
      { DB: exhaustedDb as unknown as D1Database },
      "command-1",
      { slack: vi.fn().mockRejectedValue(new Error("Still unavailable")), github: vi.fn() },
    );
    expect(exhausted).toMatchObject({ status: "failed", error: { code: "transport_failed", retryable: false } });
  });

  it("recovers stale, pending, and retrying commands", async () => {
    const database = new FakeDatabase({ recovery: [{ id: "command-1" }, { id: "command-2" }] });
    const { env, send } = environment(database);
    const result = await recoverTransportCommands(env, { limit: 50, now: new Date("2026-10-04T11:00:00Z") });
    expect(result).toEqual({ found: 2, queued: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(database.calls[0].sql).toContain("stale_transport_claim");
  });

  it("finalizes receipt-dependent state independently from provider delivery", async () => {
    const receipt = {
      contract: "platform.transport-receipt", version: 1, commandId: "command-1",
      idempotencyKey: COMMAND.idempotencyKey, operation: COMMAND.operation, provider: "slack",
      status: "delivered", attempts: 1, recordedAt: "2026-10-04T10:20:00Z",
      result: { channelId: "C123", messageId: "123.456" },
    };
    const database = new FakeDatabase({
      callbackClaim: { kind: "noxspot_issue", payload_json: JSON.stringify({ captureId: "capture-1" }) },
      callbackTransport: { command_json: JSON.stringify(COMMAND), receipt_json: JSON.stringify(receipt) },
    });
    const callback = vi.fn().mockResolvedValue(undefined);
    await expect(executeTransportCallback(database as unknown as D1Database, "command-1", {
      noxspot_issue: callback,
      noxcue_incident: vi.fn(),
    }, new Date("2026-10-04T10:21:00Z"))).resolves.toEqual({ completed: true });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ payload: { captureId: "capture-1" } }));
    expect(database.calls.some((call) => call.method === "run" && call.sql.includes("status = 'completed'"))).toBe(true);
  });
});
