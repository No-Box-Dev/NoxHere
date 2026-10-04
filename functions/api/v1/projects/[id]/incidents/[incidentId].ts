import { z } from "zod";
import { errorResponse, getCtx, jsonResponse } from "../../../../../lib/db";
import { validate } from "../../../../../lib/validate";

const BodySchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved"]),
}).strict();

interface IncidentRow {
  id: string;
  source_id: string;
  source_name: string | null;
  fingerprint: string;
  title: string;
  error_code: string | null;
  component: string | null;
  environment: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  status: "open" | "acknowledged" | "resolved";
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface Ctx {
  env: { DB: D1Database };
  data: {
    orgId: number;
    projectId?: string | null;
    userLogin: string;
    isAdmin: boolean;
    auth?: { type?: string };
  };
  params: { id: string; incidentId: string };
  request: Request;
}

function validIncidentScope(context: Ctx):
  | { ok: true; orgId: number; projectId: string; incidentId: string }
  | { ok: false; response: Response } {
  const { orgId, projectId } = getCtx(context) as Ctx["data"];
  const requestedProjectId = String(context.params.id || "");
  const incidentId = String(context.params.incidentId || "");
  if (!orgId) return { ok: false, response: errorResponse("Missing org context", 400) };
  if (!projectId || projectId !== requestedProjectId || !/^inc_[a-f0-9]{32}$/.test(incidentId)) {
    return { ok: false, response: errorResponse("Incident not found", 404) };
  }
  return { ok: true, orgId, projectId, incidentId };
}

function incidentPayload(row: IncidentRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    ...(row.source_name ? { sourceName: row.source_name } : {}),
    fingerprint: row.fingerprint,
    title: row.title,
    errorCode: row.error_code,
    component: row.component,
    environment: row.environment,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    status: row.status,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const scope = validIncidentScope(context);
  if (!scope.ok) return scope.response;

  const row = await context.env.DB.prepare(
    `SELECT incident.id, incident.source_id, source.name AS source_name,
            incident.fingerprint, incident.title, incident.error_code,
            incident.component, incident.environment, incident.first_seen_at,
            incident.last_seen_at, incident.occurrence_count, incident.status,
            incident.acknowledged_at, incident.acknowledged_by,
            incident.resolved_at, incident.resolved_by
       FROM cue_error_groups incident
       JOIN cue_sources source ON source.id = incident.source_id
      WHERE incident.id = ? AND incident.org_id = ?
        AND source.org_id = ? AND source.project_id = ?`,
  ).bind(scope.incidentId, scope.orgId, scope.orgId, scope.projectId).first<IncidentRow>();
  if (!row) return errorResponse("Incident not found", 404);

  return jsonResponse({ incident: incidentPayload(row) });
}

export async function onRequestPatch(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin, auth } = getCtx(context) as Ctx["data"];
  const scope = validIncidentScope(context);
  if (!scope.ok) return scope.response;
  if (!isAdmin && auth?.type !== "api_token") return errorResponse("Admin required", 403);

  let raw: unknown;
  try { raw = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(BodySchema, raw);
  if (!parsed.ok) return parsed.response;

  const now = new Date().toISOString();
  const row = await context.env.DB.prepare(
    `UPDATE cue_error_groups
        SET status = ?,
            acknowledged_at = CASE WHEN ? = 'acknowledged' THEN ? ELSE NULL END,
            acknowledged_by = CASE WHEN ? = 'acknowledged' THEN ? ELSE NULL END,
            resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE NULL END,
            resolved_by = CASE WHEN ? = 'resolved' THEN ? ELSE NULL END
      WHERE id = ? AND org_id = ?
        AND EXISTS (
          SELECT 1 FROM cue_sources source
           WHERE source.id = cue_error_groups.source_id
             AND source.org_id = ? AND source.project_id = ?
        )
      RETURNING id, source_id, NULL AS source_name,
                fingerprint, title, error_code, component, environment,
                first_seen_at, last_seen_at, occurrence_count, status,
                acknowledged_at, acknowledged_by, resolved_at, resolved_by`,
  ).bind(
    parsed.data.status,
    parsed.data.status, now,
    parsed.data.status, userLogin,
    parsed.data.status, now,
    parsed.data.status, userLogin,
    scope.incidentId, orgId, orgId, projectId,
  ).first<IncidentRow>();
  if (!row) return errorResponse("Incident not found", 404);

  return jsonResponse({
    incident: {
      ...incidentPayload(row),
      updatedAt: now,
    },
  });
}
