import { getCtx, errorResponse, jsonResponse } from "../../../../../../lib/db";
import { getNoxDb, type NoxDatabaseEnv } from "../../../../../../lib/nox-db";
import { createCueKey, hashCueKey } from "../../../../../../lib/noxcue-settings";

interface Ctx {
  env: NoxDatabaseEnv;
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin: boolean };
  params: { id: string; keyId: string };
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const db = getNoxDb(context.env);
  const current = await db.prepare(
    `SELECT key.name, key.kind FROM cue_source_keys key
      JOIN cue_sources source ON source.id = key.source_id
     WHERE key.id = ? AND key.source_id = ? AND key.org_id = ? AND key.revoked_at IS NULL
       ${projectId ? "AND source.project_id = ?" : ""}`,
  ).bind(...(projectId
    ? [context.params.keyId, context.params.id, orgId, projectId]
    : [context.params.keyId, context.params.id, orgId])).first<{ name: string; kind: "publishable" | "secret" }>();
  if (!current) return errorResponse("Ingest key not found", 404);

  const value = createCueKey(current.kind);
  const id = crypto.randomUUID();
  const overlapEndsAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  await db.batch([
    db.prepare("UPDATE cue_source_keys SET valid_until = ? WHERE id = ? AND valid_until IS NULL")
      .bind(overlapEndsAt, context.params.keyId),
    db.prepare(
      `INSERT INTO cue_source_keys
        (id, org_id, source_id, name, kind, key_prefix, key_hash, created_by, rotated_from_key_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, orgId, context.params.id, current.name, current.kind, value.slice(0, 20), await hashCueKey(value), userLogin, context.params.keyId),
    db.prepare(
      `INSERT INTO cue_source_key_audit
        (id, org_id, source_id, key_id, action, actor, details_json)
       VALUES (?, ?, ?, ?, 'rotated', ?, ?)`,
    ).bind(crypto.randomUUID(), orgId, context.params.id, id, userLogin, JSON.stringify({ rotatedFrom: context.params.keyId, overlapEndsAt })),
  ]);
  return jsonResponse({
    key: { id, name: current.name, kind: current.kind, prefix: value.slice(0, 20), value },
    previousKeyValidUntil: overlapEndsAt,
    warning: "Copy this key now. It cannot be shown again.",
  }, 201);
}
