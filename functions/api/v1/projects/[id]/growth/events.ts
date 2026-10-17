import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";

interface Ctx { env: { DB: D1Database }; params: { id: string }; data: { orgId: number; projectId?: string | null } }
interface GrowthEventRow { event_id: string; name: string; value: number; subject_hash: string | null; occurred_at: string; environment: string }

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context);
  if (!projectId || projectId !== String(context.params.id || "")) return errorResponse("Project scope mismatch", 403);
  const rows = await context.env.DB.prepare(
    `SELECT event.event_id, event.name, event.value, event.subject_hash, event.occurred_at, source.environment
       FROM telemetry_tracked_events event
       JOIN telemetry_sources source ON source.id = event.source_id
      WHERE source.org_id = ? AND source.project_id = ?
        AND source.capability = 'growth'
        AND (event.name LIKE 'website.%' OR event.name LIKE 'subscription.%')
      ORDER BY event.occurred_at DESC LIMIT 100`,
  ).bind(orgId, projectId).all<GrowthEventRow>();
  return jsonResponse((rows.results ?? []).map((row) => ({
    id: row.event_id,
    name: row.name,
    value: Number(row.value),
    subject: row.subject_hash ? `${row.subject_hash.slice(0, 10)}…` : null,
    environment: row.environment,
    occurredAt: row.occurred_at,
  })));
}
