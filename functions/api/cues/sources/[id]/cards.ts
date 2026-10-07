import { z } from "zod";
import { getCtx, errorResponse, jsonResponse } from "../../../../lib/db";
import { getNoxDb, type NoxDatabaseEnv } from "../../../../lib/nox-db";
import { validate } from "../../../../lib/validate";

const metricKey = z.string().trim().min(3).max(160).regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,6}$/);
const cardInput = z.object({
  cards: z.array(z.object({
    metricKey,
    enabled: z.boolean().default(true),
    dailyLabel: z.string().trim().min(1).max(80).nullable().default(null),
    cumulativeLabel: z.string().trim().min(1).max(80).nullable().default(null),
    perActiveEnabled: z.boolean().default(false),
  }).strict()).max(14),
}).strict();

interface Ctx {
  env: NoxDatabaseEnv;
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin: boolean };
  params: { id: string };
  request: Request;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  const db = getNoxDb(context.env);
  const source = await db.prepare(
    `SELECT id FROM cue_sources WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first();
  if (!source) return errorResponse("Cue source not found", 404);
  const result = await db.prepare(
    `SELECT metric_key, enabled, position, daily_label, cumulative_label, per_active_enabled
       FROM cue_source_card_settings WHERE source_id = ? AND org_id = ? ORDER BY position, metric_key`,
  ).bind(context.params.id, orgId).all<Record<string, unknown>>();
  return jsonResponse({ cards: (result.results ?? []).map((card) => ({
    metricKey: card.metric_key,
    enabled: Number(card.enabled) === 1,
    dailyLabel: card.daily_label,
    cumulativeLabel: card.cumulative_label,
    perActiveEnabled: Number(card.per_active_enabled) === 1,
  })) });
}

export async function onRequestPut(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  let raw: unknown;
  try { raw = await context.request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(cardInput, raw);
  if (!parsed.ok) return parsed.response;
  const db = getNoxDb(context.env);
  const source = await db.prepare(
    `SELECT id FROM cue_sources WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first();
  if (!source) return errorResponse("Cue source not found", 404);
  await db.batch([
    db.prepare("DELETE FROM cue_source_card_settings WHERE source_id = ? AND org_id = ?").bind(context.params.id, orgId),
    ...parsed.data.cards.map((card, position) => db.prepare(
      `INSERT INTO cue_source_card_settings
        (org_id, source_id, metric_key, enabled, position, daily_label, cumulative_label, per_active_enabled, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(orgId, context.params.id, card.metricKey, card.enabled ? 1 : 0, position,
      card.dailyLabel, card.cumulativeLabel, card.perActiveEnabled ? 1 : 0, userLogin)),
  ]);
  return jsonResponse({ ok: true, count: parsed.data.cards.length });
}
