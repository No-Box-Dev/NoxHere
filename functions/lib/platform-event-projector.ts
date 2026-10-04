import { parsePlatformEvent, type PlatformEvent } from "../../shared/platform-events";

interface EventRow {
  id: string;
  spec_version: number;
  data_version: number;
  type: PlatformEvent["type"];
  org_id: number;
  project_id: string;
  source_component: string;
  source_id: string;
  subject_type: string;
  subject_id: string;
  actor_type: string | null;
  actor_id: string | null;
  context_json: string | null;
  message_json: string | null;
  data_json: string;
  idempotency_key: string;
  correlation_id: string | null;
  causation_id: string | null;
  occurred_at: string;
}

type ProjectionModel = "activity" | "reliability" | "engagement" | "feedback" | "delivery";

function json<T>(value: string | null): T | undefined {
  return value ? JSON.parse(value) as T : undefined;
}

function actor(row: EventRow): PlatformEvent["actor"] {
  if (!row.actor_type) return undefined;
  if (row.actor_type === "system") return { type: "system" };
  if (row.actor_type === "anonymous") return row.actor_id
    ? { type: "anonymous", idHash: row.actor_id as `sha256:${string}` }
    : { type: "anonymous" };
  return { type: row.actor_type, id: row.actor_id } as PlatformEvent["actor"];
}

function eventFromRow(row: EventRow): PlatformEvent {
  return parsePlatformEvent({
    specVersion: Number(row.spec_version), dataVersion: Number(row.data_version), id: row.id,
    type: row.type, orgId: Number(row.org_id), projectId: row.project_id,
    source: { component: row.source_component, ...(row.source_id ? { sourceId: row.source_id } : {}) },
    subject: { type: row.subject_type, id: row.subject_id },
    ...(row.actor_type ? { actor: actor(row) } : {}),
    ...(row.context_json ? { context: json(row.context_json) } : {}),
    ...(row.message_json ? { message: json(row.message_json) } : {}),
    occurredAt: row.occurred_at, idempotencyKey: row.idempotency_key,
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.causation_id ? { causationId: row.causation_id } : {}),
    data: json(row.data_json),
  });
}

export function projectionModel(type: PlatformEvent["type"]): ProjectionModel {
  if (type.startsWith("reliability.")) return "reliability";
  if (type.startsWith("engagement.")) return "engagement";
  if (type.startsWith("feedback.")) return "feedback";
  if (type.startsWith("delivery.")) return "delivery";
  return "activity";
}

export function shouldReplaceProjection(
  current: { lastOccurredAt: string; lastEventId: string } | null,
  candidate: Pick<PlatformEvent, "occurredAt" | "id">,
): boolean {
  if (!current) return true;
  return candidate.occurredAt > current.lastOccurredAt
    || (candidate.occurredAt === current.lastOccurredAt && candidate.id > current.lastEventId);
}

function stateFor(event: PlatformEvent): string | null {
  switch (event.type) {
    case "reliability.error.detected": return "detected";
    case "reliability.incident.opened": return "open";
    case "reliability.incident.resolved": return "resolved";
    case "feedback.report.created": return "open";
    case "feedback.report.reopened": return "reopened";
    case "feedback.report.resolved": return "resolved";
    default: return null;
  }
}

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error ?? "Projection failed")).slice(0, 1_000);
}

export async function projectPlatformEvent(db: D1Database, eventId: string, now = new Date()) {
  const current = now.toISOString();
  const row = await db.prepare(
    `UPDATE platform_events
        SET projection_status = 'processing', projection_attempts = projection_attempts + 1,
            last_error = NULL, updated_at = ?
      WHERE id = ? AND projection_status IN ('pending', 'queued', 'failed')
      RETURNING id, spec_version, data_version, type, org_id, project_id,
                source_component, source_id, subject_type, subject_id, actor_type, actor_id,
                context_json, message_json, data_json, idempotency_key, correlation_id,
                causation_id, occurred_at`,
  ).bind(current, eventId).first<EventRow>();
  if (!row) return { skipped: "not_claimable" as const };

  try {
    const event = eventFromRow(row);
    const model = projectionModel(event.type);
    const state = stateFor(event);
    const statements = [db.prepare(
      `INSERT INTO platform_projection_events
         (event_id, model, org_id, project_id, event_type, subject_type, subject_id,
          occurred_at, summary, data_json, projected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id) DO NOTHING`,
    ).bind(
      event.id, model, event.orgId, event.projectId, event.type, event.subject.type,
      event.subject.id, event.occurredAt, event.message?.summary ?? event.message?.title ?? null,
      JSON.stringify(event.data), current,
    )];
    if (state && (model === "reliability" || model === "feedback")) {
      statements.push(db.prepare(
        `INSERT INTO platform_projection_state
           (model, org_id, project_id, subject_type, subject_id, state, last_event_id,
            last_event_type, last_occurred_at, data_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(model, org_id, project_id, subject_type, subject_id) DO UPDATE SET
           state = excluded.state, last_event_id = excluded.last_event_id,
           last_event_type = excluded.last_event_type, last_occurred_at = excluded.last_occurred_at,
           data_json = excluded.data_json, updated_at = excluded.updated_at
         WHERE excluded.last_occurred_at > platform_projection_state.last_occurred_at
            OR (excluded.last_occurred_at = platform_projection_state.last_occurred_at
                AND excluded.last_event_id > platform_projection_state.last_event_id)`,
      ).bind(
        model, event.orgId, event.projectId, event.subject.type, event.subject.id, state,
        event.id, event.type, event.occurredAt, JSON.stringify(event.data), current,
      ));
    }
    statements.push(db.prepare(
      `UPDATE platform_events SET projection_status = 'projected', projected_at = ?,
              last_error = NULL, updated_at = ? WHERE id = ? AND projection_status = 'processing'`,
    ).bind(current, current, event.id));
    await db.batch(statements);
    return { projected: true as const, eventId: event.id, model };
  } catch (error) {
    await db.prepare(
      `UPDATE platform_events SET projection_status = 'failed', last_error = ?, updated_at = ?
        WHERE id = ? AND projection_status = 'processing'`,
    ).bind(errorText(error), current, eventId).run();
    throw error;
  }
}
