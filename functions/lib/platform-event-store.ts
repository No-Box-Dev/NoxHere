import { parsePlatformEvent, type PlatformEvent } from "../../shared/platform-events";
import { TASK } from "./tasks.js";

type PlatformEventStoreBindings = Pick<Env, "DB" | "TASK_QUEUE">;

export interface StoredPlatformEvent {
  id: string;
  orgId: number;
  projectId: string;
  type: PlatformEvent["type"];
  projectionStatus: "pending" | "queued" | "processing" | "projected" | "failed";
  receivedAt: string;
}

export interface PlatformEventPublication {
  event: StoredPlatformEvent;
  duplicate: boolean;
  queued: boolean;
}

interface EventRow {
  id: string;
  org_id: number;
  project_id: string;
  type: PlatformEvent["type"];
  projection_status: StoredPlatformEvent["projectionStatus"];
  received_at: string;
}

interface RecoveryRow {
  id: string;
  org_id: number;
  project_id: string;
}

const DEFAULT_RECOVERY_LIMIT = 100;
const MAX_RECOVERY_LIMIT = 500;

function storedEvent(row: EventRow): StoredPlatformEvent {
  return {
    id: row.id,
    orgId: Number(row.org_id),
    projectId: row.project_id,
    type: row.type,
    projectionStatus: row.projection_status,
    receivedAt: row.received_at,
  };
}

function actorId(event: PlatformEvent): string | null {
  if (!event.actor || event.actor.type === "system") return null;
  if (event.actor.type === "anonymous") return event.actor.idHash ?? null;
  return event.actor.id;
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? "Unknown Queue error")).slice(0, 1_000);
}

async function enqueueProjection(
  env: PlatformEventStoreBindings,
  event: Pick<StoredPlatformEvent, "id" | "orgId" | "projectId">,
  queuedAt: string,
): Promise<boolean> {
  try {
    await env.TASK_QUEUE.send({
      type: TASK.PROJECT_PLATFORM_EVENT,
      eventId: event.id,
      orgId: event.orgId,
      projectId: event.projectId,
      deliveryId: event.id,
    });
    await env.DB.prepare(
      `UPDATE platform_events
          SET projection_status = 'queued', last_queued_at = ?, last_error = NULL, updated_at = ?
        WHERE id = ? AND projection_status IN ('pending', 'failed')`,
    ).bind(queuedAt, queuedAt, event.id).run();
    return true;
  } catch (error) {
    await env.DB.prepare(
      `UPDATE platform_events
          SET projection_status = 'pending', last_error = ?, updated_at = ?
        WHERE id = ? AND projection_status != 'projected'`,
    ).bind(errorText(error), queuedAt, event.id).run();
    return false;
  }
}

async function findDuplicate(env: PlatformEventStoreBindings, event: PlatformEvent): Promise<EventRow | null> {
  return env.DB.prepare(
    `SELECT id, org_id, project_id, type, projection_status, received_at
       FROM platform_events
      WHERE source_component = ? AND source_id = ? AND idempotency_key = ?
      LIMIT 1`,
  ).bind(event.source.component, event.source.sourceId ?? "", event.idempotencyKey).first<EventRow>();
}

export async function publishPlatformEvent(
  env: PlatformEventStoreBindings,
  input: unknown,
  now = new Date(),
): Promise<PlatformEventPublication> {
  const event = parsePlatformEvent(input);
  const receivedAt = now.toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO platform_events
       (id, spec_version, data_version, type, org_id, project_id,
        source_component, source_id, subject_type, subject_id, actor_type, actor_id,
        context_json, message_json, data_json, idempotency_key, correlation_id, causation_id,
        occurred_at, received_at, projection_status, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?
       FROM projects project
      WHERE project.id = ? AND project.org_id = ?
     ON CONFLICT DO NOTHING
     RETURNING id, org_id, project_id, type, projection_status, received_at`,
  ).bind(
    event.id,
    event.specVersion,
    event.dataVersion,
    event.type,
    event.orgId,
    event.projectId,
    event.source.component,
    event.source.sourceId ?? "",
    event.subject.type,
    event.subject.id,
    event.actor?.type ?? null,
    actorId(event),
    event.context ? JSON.stringify(event.context) : null,
    event.message ? JSON.stringify(event.message) : null,
    JSON.stringify(event.data),
    event.idempotencyKey,
    event.correlationId ?? null,
    event.causationId ?? null,
    event.occurredAt,
    receivedAt,
    receivedAt,
    event.projectId,
    event.orgId,
  ).first<EventRow>();

  if (!row) {
    const duplicate = await findDuplicate(env, event);
    if (duplicate) return { event: storedEvent(duplicate), duplicate: true, queued: false };
    const idConflict = await env.DB.prepare(
      "SELECT id FROM platform_events WHERE id = ? LIMIT 1",
    ).bind(event.id).first<{ id: string }>();
    if (idConflict) throw new Error("platform_event_id_conflict");
    throw new Error("platform_event_project_scope_invalid");
  }

  const stored = storedEvent(row);
  const queued = await enqueueProjection(env, stored, receivedAt);
  return {
    event: { ...stored, projectionStatus: queued ? "queued" : "pending" },
    duplicate: false,
    queued,
  };
}

export async function recoverPlatformEventProjections(
  env: PlatformEventStoreBindings,
  options: { limit?: number; now?: Date } = {},
): Promise<{ found: number; queued: number }> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_RECOVERY_LIMIT, 1), MAX_RECOVERY_LIMIT);
  const now = options.now ?? new Date();
  const queuedAt = now.toISOString();
  const staleBefore = new Date(now.valueOf() - 15 * 60_000).toISOString();

  await env.DB.prepare(
    `UPDATE platform_events
        SET projection_status = 'pending', last_error = 'stale_projection_claim', updated_at = ?
      WHERE projection_status IN ('queued', 'processing') AND updated_at < ?`,
  ).bind(queuedAt, staleBefore).run();

  const { results } = await env.DB.prepare(
    `SELECT id, org_id, project_id
       FROM platform_events
      WHERE projection_status IN ('pending', 'failed')
      ORDER BY received_at, id
      LIMIT ?`,
  ).bind(limit).all<RecoveryRow>();

  let queued = 0;
  for (const row of results ?? []) {
    if (await enqueueProjection(env, {
      id: row.id,
      orgId: Number(row.org_id),
      projectId: row.project_id,
    }, queuedAt)) queued += 1;
  }
  return { found: results?.length ?? 0, queued };
}
