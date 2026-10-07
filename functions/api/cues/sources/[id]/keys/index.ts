import { getCtx, errorResponse, jsonResponse } from "../../../../../lib/db";
import { getNoxDb, type NoxDatabaseEnv } from "../../../../../lib/nox-db";
import { createCueKey, createCueKeySchema, hashCueKey } from "../../../../../lib/noxcue-settings";
import { validate } from "../../../../../lib/validate";

interface Ctx {
  env: NoxDatabaseEnv;
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin: boolean };
  params: { id: string };
  request: Request;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const db = getNoxDb(context.env);
  const source = await db.prepare(
    `SELECT id FROM cue_sources WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first();
  if (!source) return errorResponse("Cue source not found", 404);
  const [keys, usage, audit] = await Promise.all([
    db.prepare(
      `SELECT id, name, kind, key_prefix, created_by, created_at, last_used_at, revoked_at,
              valid_until, rotated_from_key_id
         FROM cue_source_keys WHERE org_id = ? AND source_id = ? ORDER BY created_at DESC`,
    ).bind(orgId, context.params.id).all(),
    db.prepare(
      `SELECT key_id, period, request_count, first_used_at, last_used_at
         FROM cue_source_key_daily_usage WHERE org_id = ? AND source_id = ?
        ORDER BY period DESC, key_id LIMIT 366`,
    ).bind(orgId, context.params.id).all(),
    db.prepare(
      `SELECT id, key_id, action, actor, details_json, created_at
         FROM cue_source_key_audit WHERE org_id = ? AND source_id = ?
        ORDER BY created_at DESC LIMIT 200`,
    ).bind(orgId, context.params.id).all(),
  ]);
  return jsonResponse({
    keys: keys.results ?? [],
    usage: usage.results ?? [],
    audit: (audit.results ?? []).map((row) => ({ ...row, details: JSON.parse(String(row.details_json || "{}")), details_json: undefined })),
  });
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const db = getNoxDb(context.env);
  let raw: unknown;
  try { raw = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(createCueKeySchema, raw);
  if (!parsed.ok) return parsed.response;

  const source = await db.prepare(
    `SELECT id FROM cue_sources
      WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first<{ id: string }>();
  if (!source) return errorResponse("Cue source not found", 404);

  const value = createCueKey(parsed.data.kind);
  const id = crypto.randomUUID();
  await db.batch([db.prepare(
    `INSERT INTO cue_source_keys
       (id, org_id, source_id, name, kind, key_prefix, key_hash, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, orgId, source.id, parsed.data.name, parsed.data.kind,
    value.slice(0, 20), await hashCueKey(value), userLogin,
  ), db.prepare(
    `INSERT INTO cue_source_key_audit (id, org_id, source_id, key_id, action, actor)
     VALUES (?, ?, ?, ?, 'created', ?)`,
  ).bind(crypto.randomUUID(), orgId, source.id, id, userLogin)]);
  return jsonResponse({
    key: { id, name: parsed.data.name, kind: parsed.data.kind, prefix: value.slice(0, 20), value },
    warning: "Copy this key now. It cannot be shown again.",
  }, 201);
}
