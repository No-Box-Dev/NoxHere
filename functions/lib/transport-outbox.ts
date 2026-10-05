import {
  parseTransportCommand,
  parseTransportReceipt,
  providerForOperation,
  type TransportCommand,
  type TransportProvider,
  type TransportReceipt,
} from "../../packages/contracts/transport-commands";
interface TransportBindings {
  DB: D1Database;
  TASK_QUEUE: Pick<Queue, "send">;
}
const DELIVER_TRANSPORT_TASK = "deliver_transport";
const FINALIZE_TRANSPORT_TASK = "finalize_transport";
type TransportStatus = "pending" | "queued" | "processing" | "retrying" | "blocked" | "delivered" | "failed";

interface OutboxRow {
  id: string;
  org_id: number;
  project_id: string;
  provider: TransportProvider;
  operation: TransportCommand["operation"];
  idempotency_key: string;
  command_json: string;
  status: TransportStatus;
  attempt_count: number;
  max_attempts: number;
  receipt_json: string | null;
}

export interface TransportPublication {
  outboxId: string;
  status: TransportStatus;
  duplicate: boolean;
  queued: boolean;
}

export interface SlackTransportPublicationInput {
  orgId: number;
  projectId: string;
  route: Extract<TransportCommand, { operation: "slack.message.send" }>["route"];
  routeContext?: { kind: "source" | "site"; id: string };
  idempotencyKey: string;
  message: Extract<TransportCommand, { operation: "slack.message.send" }>["input"]["message"];
  causedByEventId?: string;
  correlationId?: string;
  requestedAt?: Date;
}

export interface GitHubTransportPublicationInput {
  orgId: number;
  projectId: string;
  route: Extract<TransportCommand, { operation: `github.${string}` }>["route"];
  idempotencyKey: string;
  operation: Extract<TransportCommand, { operation: `github.${string}` }>["operation"];
  input: Extract<TransportCommand, { operation: `github.${string}` }>["input"];
  causedByEventId?: string;
  correlationId?: string;
  requestedAt?: Date;
  callback?: TransportCallback;
}

export interface TransportCallback {
  kind: "noxspot_issue" | "noxcue_incident";
  payload: Record<string, unknown>;
}

export type TransportProviderResult =
  | { provider: "slack"; result: { channelId: string; messageId: string } }
  | { provider: "github"; result: { resourceType: "issue" | "pull_request" | "comment"; resourceId: string; url?: string; state?: string } };

export type TransportHandlers = {
  [Provider in TransportProvider]: (command: TransportCommand) => Promise<Extract<TransportProviderResult, { provider: Provider }>["result"]>;
};

export class TransportExecutionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly disposition: "retryable" | "blocked" | "failed" = "retryable",
  ) {
    super(message);
    this.name = "TransportExecutionError";
  }
}

function errorDetails(error: unknown) {
  if (error instanceof TransportExecutionError) return error;
  return new TransportExecutionError(error instanceof Error ? error.message : String(error ?? "Unknown transport error"), "transport_failed");
}

function receiptFor(
  row: OutboxRow,
  status: "queued" | "processing" | "delivered" | "blocked" | "failed",
  recordedAt: string,
  extras: { result?: TransportProviderResult["result"]; error?: { code: string; message: string; retryable: boolean } } = {},
): TransportReceipt {
  return parseTransportReceipt({
    contract: "platform.transport-receipt",
    version: 1,
    commandId: row.id,
    idempotencyKey: row.idempotency_key,
    operation: row.operation,
    provider: row.provider,
    status,
    attempts: Number(row.attempt_count),
    recordedAt,
    ...extras,
  });
}

async function queueTransport(env: TransportBindings, outboxId: string, now: string): Promise<boolean> {
  try {
    await env.TASK_QUEUE.send({ type: DELIVER_TRANSPORT_TASK, outboxId, deliveryId: outboxId });
    await env.DB.prepare(
      `UPDATE transport_outbox SET status = 'queued', last_error_code = NULL, last_error = NULL,
              next_attempt_at = NULL, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'retrying')`,
    ).bind(now, outboxId).run();
    return true;
  } catch (error) {
    await env.DB.prepare(
      `UPDATE transport_outbox SET status = 'pending', last_error_code = 'queue_send_failed',
              last_error = ?, updated_at = ?
        WHERE id = ? AND status != 'delivered'`,
    ).bind(error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000), now, outboxId).run();
    return false;
  }
}

export async function publishTransportCommand(
  env: TransportBindings,
  input: unknown,
  now = new Date(),
  callback?: TransportCallback,
): Promise<TransportPublication> {
  const command = parseTransportCommand(input);
  const provider = providerForOperation(command.operation);
  const createdAt = now.toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO transport_outbox
       (id, org_id, project_id, source_event_id, correlation_id, provider, operation,
        route, idempotency_key, command_json, status, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
       FROM projects project
      WHERE project.id = ? AND project.org_id = ?
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM platform_events event
           WHERE event.id = ? AND event.org_id = ? AND event.project_id = ?
        ))
     ON CONFLICT DO NOTHING
     RETURNING id, org_id, project_id, provider, operation, idempotency_key,
               command_json, status, attempt_count, max_attempts, receipt_json`,
  ).bind(
    command.commandId,
    command.orgId,
    command.projectId,
    command.causedByEventId ?? null,
    command.correlationId ?? null,
    provider,
    command.operation,
    command.route,
    command.idempotencyKey,
    JSON.stringify(command),
    createdAt,
    createdAt,
    command.projectId,
    command.orgId,
    command.causedByEventId ?? null,
    command.causedByEventId ?? null,
    command.orgId,
    command.projectId,
  ).first<OutboxRow>();

  if (!row) {
    const duplicate = await env.DB.prepare(
      `SELECT id, org_id, project_id, provider, operation, idempotency_key,
              command_json, status, attempt_count, max_attempts, receipt_json
         FROM transport_outbox
        WHERE provider = ? AND operation = ? AND idempotency_key = ? LIMIT 1`,
    ).bind(provider, command.operation, command.idempotencyKey).first<OutboxRow>();
    if (duplicate) {
      if (callback) {
        await storeTransportCallback(env.DB, duplicate.id, callback, createdAt);
        if (["delivered", "blocked", "failed"].includes(duplicate.status)) {
          await queueTransportCallback(env, duplicate.id, createdAt);
        }
      }
      return { outboxId: duplicate.id, status: duplicate.status, duplicate: true, queued: false };
    }
    const idConflict = await env.DB.prepare("SELECT id FROM transport_outbox WHERE id = ? LIMIT 1")
      .bind(command.commandId).first<{ id: string }>();
    if (idConflict) throw new Error("transport_command_id_conflict");
    throw new Error("transport_command_scope_invalid");
  }

  if (callback) await storeTransportCallback(env.DB, row.id, callback, createdAt);
  const queued = await queueTransport(env, row.id, createdAt);
  return { outboxId: row.id, status: queued ? "queued" : "pending", duplicate: false, queued };
}

export function publishSlackTransport(
  env: TransportBindings,
  input: SlackTransportPublicationInput,
): Promise<TransportPublication> {
  const requestedAt = input.requestedAt ?? new Date();
  return publishTransportCommand(env, {
    contract: "platform.transport-command",
    version: 1,
    commandId: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    orgId: input.orgId,
    projectId: input.projectId,
    route: input.route,
    ...(input.routeContext ? { routeContext: input.routeContext } : {}),
    requestedAt: requestedAt.toISOString(),
    operation: "slack.message.send",
    input: { message: input.message },
    ...(input.causedByEventId ? { causedByEventId: input.causedByEventId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  }, requestedAt);
}

async function storeTransportCallback(db: D1Database, outboxId: string, callback: TransportCallback, now: string) {
  const serialized = JSON.stringify(callback.payload);
  if (new TextEncoder().encode(serialized).byteLength > 64_000) throw new Error("Transport callback exceeds 64000 bytes");
  await db.prepare(
    `INSERT INTO transport_callbacks (transport_id, kind, payload_json, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?) ON CONFLICT(transport_id) DO NOTHING`,
  ).bind(outboxId, callback.kind, serialized, now, now).run();
}

async function queueTransportCallback(env: TransportBindings, outboxId: string, now: string): Promise<boolean> {
  const callback = await env.DB.prepare(
    "SELECT transport_id FROM transport_callbacks WHERE transport_id = ? AND status = 'pending' LIMIT 1",
  ).bind(outboxId).first<{ transport_id: string }>();
  if (!callback) return false;
  try {
    await env.TASK_QUEUE.send({ type: FINALIZE_TRANSPORT_TASK, outboxId, deliveryId: `finalize:${outboxId}` });
    await env.DB.prepare(
      "UPDATE transport_callbacks SET status = 'queued', updated_at = ? WHERE transport_id = ? AND status = 'pending'",
    ).bind(now, outboxId).run();
    return true;
  } catch (error) {
    await env.DB.prepare(
      "UPDATE transport_callbacks SET last_error = ?, updated_at = ? WHERE transport_id = ? AND status = 'pending'",
    ).bind(error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000), now, outboxId).run();
    return false;
  }
}

export function publishGitHubTransport(
  env: TransportBindings,
  input: GitHubTransportPublicationInput,
): Promise<TransportPublication> {
  const requestedAt = input.requestedAt ?? new Date();
  return publishTransportCommand(env, {
    contract: "platform.transport-command",
    version: 1,
    commandId: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    orgId: input.orgId,
    projectId: input.projectId,
    route: input.route,
    requestedAt: requestedAt.toISOString(),
    operation: input.operation,
    input: input.input,
    ...(input.causedByEventId ? { causedByEventId: input.causedByEventId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  }, requestedAt, input.callback);
}

export async function claimTransportCommand(
  db: D1Database,
  outboxId: string,
  now = new Date(),
): Promise<OutboxRow | null> {
  const current = now.toISOString();
  const lease = new Date(now.valueOf() + 5 * 60_000).toISOString();
  return db.prepare(
    `UPDATE transport_outbox
        SET status = 'processing', attempt_count = attempt_count + 1,
            lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('pending', 'queued', 'retrying')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      RETURNING id, org_id, project_id, provider, operation, idempotency_key,
                command_json, status, attempt_count, max_attempts, receipt_json`,
  ).bind(lease, current, outboxId, current).first<OutboxRow>();
}

async function finish(
  db: D1Database,
  row: OutboxRow,
  receipt: TransportReceipt,
  now: string,
): Promise<void> {
  await db.prepare(
    `UPDATE transport_outbox SET status = ?, receipt_json = ?, lease_expires_at = NULL,
            next_attempt_at = NULL, last_error_code = ?, last_error = ?,
            delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
            updated_at = ?
      WHERE id = ?`,
  ).bind(
    receipt.status,
    JSON.stringify(receipt),
    receipt.error?.code ?? null,
    receipt.error?.message ?? null,
    receipt.status,
    now,
    now,
    row.id,
  ).run();
}

export async function executeTransportCommand(
  env: Pick<TransportBindings, "DB"> & Partial<Pick<TransportBindings, "TASK_QUEUE">>,
  outboxId: string,
  handlers: TransportHandlers,
  now = new Date(),
): Promise<TransportReceipt | { skipped: "not_claimable" }> {
  const row = await claimTransportCommand(env.DB, outboxId, now);
  if (!row) return { skipped: "not_claimable" };
  const command = parseTransportCommand(JSON.parse(row.command_json));
  const recordedAt = now.toISOString();
  try {
    const result = row.provider === "slack"
      ? await handlers.slack(command)
      : await handlers.github(command);
    const receipt = receiptFor(row, "delivered", recordedAt, { result });
    await finish(env.DB, row, receipt, recordedAt);
    if (env.TASK_QUEUE) await queueTransportCallback(env as TransportBindings, row.id, recordedAt);
    return receipt;
  } catch (cause) {
    const error = errorDetails(cause);
    const exhausted = Number(row.attempt_count) >= Number(row.max_attempts);
    if (error.disposition === "retryable" && !exhausted) {
      await env.DB.prepare(
        `UPDATE transport_outbox SET status = 'retrying', lease_expires_at = NULL,
                next_attempt_at = ?, last_error_code = ?, last_error = ?, updated_at = ?
          WHERE id = ?`,
      ).bind(
        new Date(now.valueOf() + 5 * 60_000).toISOString(),
        error.code,
        error.message.slice(0, 1_000),
        recordedAt,
        row.id,
      ).run();
      throw error;
    }
    const status = error.disposition === "blocked" ? "blocked" : "failed";
    const receipt = receiptFor(row, status, recordedAt, {
      error: { code: error.code, message: error.message.slice(0, 1_000), retryable: false },
    });
    await finish(env.DB, row, receipt, recordedAt);
    if (env.TASK_QUEUE) await queueTransportCallback(env as TransportBindings, row.id, recordedAt);
    return receipt;
  }
}

export type TransportCallbackHandler = (input: {
  command: TransportCommand;
  receipt: TransportReceipt;
  payload: Record<string, unknown>;
}) => Promise<void>;

export async function executeTransportCallback(
  db: D1Database,
  outboxId: string,
  handlers: Record<TransportCallback["kind"], TransportCallbackHandler>,
  now = new Date(),
): Promise<{ completed: true } | { skipped: "not_claimable" }> {
  const current = now.toISOString();
  const lease = new Date(now.valueOf() + 5 * 60_000).toISOString();
  const row = await db.prepare(
    `UPDATE transport_callbacks SET status = 'processing', attempt_count = attempt_count + 1,
            lease_expires_at = ?, updated_at = ?
      WHERE transport_id = ? AND status IN ('pending', 'queued')
      RETURNING kind, payload_json`,
  ).bind(lease, current, outboxId).first<{ kind: TransportCallback["kind"]; payload_json: string }>();
  if (!row) return { skipped: "not_claimable" };
  try {
    const transport = await db.prepare(
      "SELECT command_json, receipt_json FROM transport_outbox WHERE id = ? AND receipt_json IS NOT NULL LIMIT 1",
    ).bind(outboxId).first<{ command_json: string; receipt_json: string }>();
    if (!transport) throw new Error("Transport receipt is unavailable");
    await handlers[row.kind]({
      command: parseTransportCommand(JSON.parse(transport.command_json)),
      receipt: parseTransportReceipt(JSON.parse(transport.receipt_json)),
      payload: JSON.parse(row.payload_json),
    });
    await db.prepare(
      `UPDATE transport_callbacks SET status = 'completed', lease_expires_at = NULL,
              last_error = NULL, completed_at = ?, updated_at = ? WHERE transport_id = ?`,
    ).bind(current, current, outboxId).run();
    return { completed: true };
  } catch (error) {
    await db.prepare(
      `UPDATE transport_callbacks SET status = 'pending', lease_expires_at = NULL,
              last_error = ?, updated_at = ? WHERE transport_id = ?`,
    ).bind(error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000), current, outboxId).run();
    throw error;
  }
}

export async function recoverTransportCallbacks(
  env: TransportBindings,
  options: { limit?: number; now?: Date } = {},
): Promise<{ found: number; queued: number }> {
  const now = options.now ?? new Date();
  const current = now.toISOString();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  await env.DB.prepare(
    `UPDATE transport_callbacks SET status = 'pending', lease_expires_at = NULL,
            last_error = 'stale_callback_claim', updated_at = ?
      WHERE status = 'processing' AND lease_expires_at < ?`,
  ).bind(current, current).run();
  const { results } = await env.DB.prepare(
    `SELECT callback.transport_id FROM transport_callbacks callback
       JOIN transport_outbox transport ON transport.id = callback.transport_id
      WHERE callback.status = 'pending' AND transport.status IN ('delivered', 'blocked', 'failed')
      ORDER BY callback.created_at LIMIT ?`,
  ).bind(limit).all<{ transport_id: string }>();
  let queued = 0;
  for (const row of results ?? []) if (await queueTransportCallback(env, row.transport_id, current)) queued += 1;
  return { found: results?.length ?? 0, queued };
}

export async function recoverTransportCommands(
  env: TransportBindings,
  options: { limit?: number; now?: Date } = {},
): Promise<{ found: number; queued: number }> {
  const now = options.now ?? new Date();
  const current = now.toISOString();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  await env.DB.prepare(
    `UPDATE transport_outbox SET status = 'retrying', lease_expires_at = NULL,
            next_attempt_at = NULL, last_error_code = 'stale_transport_claim', updated_at = ?
      WHERE status = 'processing' AND lease_expires_at < ?`,
  ).bind(current, current).run();
  const { results } = await env.DB.prepare(
    `SELECT id FROM transport_outbox
      WHERE status IN ('pending', 'retrying')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at, id LIMIT ?`,
  ).bind(current, limit).all<{ id: string }>();
  let queued = 0;
  for (const row of results ?? []) {
    if (await queueTransport(env, row.id, current)) queued += 1;
  }
  return { found: results?.length ?? 0, queued };
}

export async function requeueBlockedTransportCommands(
  env: TransportBindings,
  scope: { orgId: number; projectId?: string | null; routeContext?: { kind: "source" | "site"; id: string } },
  now = new Date(),
): Promise<{ found: number; queued: number }> {
  const current = now.toISOString();
  const { results } = await env.DB.prepare(
    `UPDATE transport_outbox
        SET status = 'pending', next_attempt_at = NULL, lease_expires_at = NULL,
            last_error_code = NULL, last_error = NULL, updated_at = ?
      WHERE provider = 'slack' AND org_id = ?
        AND (? IS NULL OR project_id = ?)
        AND (? IS NULL OR (
          json_extract(command_json, '$.routeContext.kind') = ?
          AND json_extract(command_json, '$.routeContext.id') = ?
        ))
        AND status IN ('blocked', 'failed')
      RETURNING id`,
  ).bind(
    current,
    scope.orgId,
    scope.projectId ?? null,
    scope.projectId ?? null,
    scope.routeContext?.id ?? null,
    scope.routeContext?.kind ?? null,
    scope.routeContext?.id ?? null,
  ).all<{ id: string }>();
  let queued = 0;
  for (const row of results ?? []) {
    if (await queueTransport(env, row.id, current)) queued += 1;
  }
  return { found: results?.length ?? 0, queued };
}
