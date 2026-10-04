import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";
interface Ctx { env: { DB: D1Database }; request: Request; params: { id: string }; data: { orgId: number; projectId?: string | null } }
interface AlertRow { id: string; source_id: string; fingerprint: string; title: string; error_code: string | null; component: string | null; environment: string | null; last_seen_at: string; occurrence_count: number; status: string }

export async function onRequestGet(context: Ctx) {
  const { orgId, projectId } = getCtx(context);
  if (!projectId || projectId !== String(context.params.id || "")) return errorResponse("Project scope mismatch", 403);
  const rows = await context.env.DB.prepare(
    `SELECT error.id, error.source_id, error.fingerprint, error.title, error.error_code, error.component,
            COALESCE(error.environment, source.environment) AS environment,
            error.last_seen_at, error.occurrence_count, COALESCE(error.status, 'open') AS status
       FROM cue_error_groups error JOIN cue_sources source ON source.id = error.source_id
      WHERE source.org_id = ? AND source.project_id = ?
      ORDER BY error.last_seen_at DESC LIMIT 100`,
  ).bind(orgId, projectId).all();
  return jsonResponse(((rows.results ?? []) as unknown as AlertRow[]).map((row) => ({
    id: row.id,
    title: String(row.title),
    environment: String(row.environment || "production"),
    summary: [row.component, row.error_code].filter(Boolean).join(" · ") || "Application error",
    status: row.status === "resolved" ? "resolved" : "active",
    occurrences: Number(row.occurrence_count || 1),
    happenedAt: String(row.last_seen_at),
  })));
}
