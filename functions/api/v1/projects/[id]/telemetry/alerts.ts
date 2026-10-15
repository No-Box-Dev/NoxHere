import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";

interface Ctx { env: { DB: D1Database }; params: { id: string }; data: { orgId: number; projectId?: string | null } }
interface AlertRow { source_id: string; fingerprint: string; title: string; error_code: string | null; component: string | null; environment: string | null; last_seen_at: string; occurrence_count: number; status: string; payload_json: string | null }

function diagnostics(raw: string | null) {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
    const context = payload.context && typeof payload.context === "object" ? payload.context as Record<string, unknown> : {};
    const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
    const attributes = data.attributes && typeof data.attributes === "object" ? data.attributes as Record<string, unknown> : {};
    return {
      eventId: typeof payload.eventId === "string" ? payload.eventId : null,
      message: typeof payload.message === "string" ? payload.message : null,
      url: typeof payload.url === "string" ? payload.url : null,
      error: {
        name: typeof error.name === "string" ? error.name : null,
        message: typeof error.message === "string" ? error.message : null,
        code: typeof error.code === "string" ? error.code : null,
        status: typeof error.status === "number" ? error.status : null,
        stack: typeof error.stack === "string" ? error.stack : null,
      },
      context: {
        release: typeof context.release === "string" ? context.release : null,
        runtime: typeof context.runtime === "string" ? context.runtime : null,
        sdkVersion: typeof context.sdkVersion === "string" ? context.sdkVersion : null,
      },
      attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean")),
    };
  } catch {
    return null;
  }
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context);
  if (!projectId || projectId !== String(context.params.id || "")) return errorResponse("Project scope mismatch", 403);
  const rows = await context.env.DB.prepare(
    `SELECT error.source_id, error.fingerprint, error.title, error.error_code, error.component,
            COALESCE(error.environment, source.environment) AS environment,
            error.last_seen_at, error.occurrence_count, COALESCE(error.status, 'open') AS status,
            error.sample_json AS payload_json
       FROM cue_error_groups error JOIN cue_sources source ON source.id = error.source_id
      WHERE source.org_id = ? AND source.project_id = ?
      ORDER BY error.last_seen_at DESC LIMIT 100`,
  ).bind(orgId, projectId).all();
  return jsonResponse(((rows.results ?? []) as unknown as AlertRow[]).map((row) => ({
    id: `${row.source_id}:${row.fingerprint}`,
    sourceId: String(row.source_id),
    fingerprint: String(row.fingerprint),
    title: String(row.title),
    environment: String(row.environment || "production"),
    summary: [row.component, row.error_code].filter(Boolean).join(" · ") || "Application error",
    status: row.status === "resolved" ? "resolved" : "active",
    occurrences: Number(row.occurrence_count || 1),
    happenedAt: String(row.last_seen_at),
    diagnostics: diagnostics(row.payload_json),
  })));
}
