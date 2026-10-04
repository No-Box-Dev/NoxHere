import { z } from "zod";
import { getCtx, jsonResponse, errorResponse } from "../../../../../lib/db";
import { validate } from "../../../../../lib/validate";
import { canReadProjectResource } from "../../../../../lib/api-auth.js";

const METRIC_KEY = /^custom\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,4}$/;
const ActionsSchema = z.object({
  actions: z.array(z.object({
    key: z.string().trim().min(8).max(120).regex(METRIC_KEY, "Use a custom.* lowercase dot-separated key"),
    label: z.string().trim().min(1).max(80),
  }).strict()).min(1).max(3).refine((actions) => new Set(actions.map((action) => action.key)).size === actions.length, "Action keys must be unique"),
  windowDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
}).strict();

interface Ctx {
  env: { DB: D1Database };
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin: boolean; auth?: { type?: string } };
  params: { id: string };
  request: Request;
}

interface ActionRow { metric_key: string; label: string; template_slot: number | null }

function scoped(context: Ctx) {
  const data = getCtx(context) as Ctx["data"];
  const requestedProject = String(context.params.id || "");
  return { data, requestedProject, matches: Boolean(data.projectId && data.projectId === requestedProject) };
}

const STARTER_ACTIONS: ActionRow[] = [
  { metric_key: "custom.comments.written", label: "Comments written", template_slot: 1 },
  { metric_key: "custom.journals.added", label: "Journals added", template_slot: 2 },
  { metric_key: "custom.reviews.written", label: "Reviews written", template_slot: 3 },
];

function response(projectId: string, rows: ActionRow[], windowDays: number) {
  const actions = rows.map((row, index) => ({ slot: Number(row.template_slot ?? index + 1), key: row.metric_key, label: row.label }));
  return {
    projectId,
    windowDays,
    actions,
    snippet: actions.map((action) => `await noxCue.activity("${action.key}", user.id);`).join("\n"),
  };
}

export async function onRequestGet(context: Ctx) {
  const { data, requestedProject, matches } = scoped(context);
  if (!matches) return errorResponse("Project scope mismatch", 403);
  if (!canReadProjectResource(data)) return errorResponse("Admin required", 403);
  const [configured, setting] = await Promise.all([context.env.DB.prepare(
    `SELECT metric_key, label, template_slot
       FROM cue_custom_metrics
      WHERE org_id = ? AND project_id = ? AND enabled = 1 AND template_slot IS NOT NULL
      ORDER BY template_slot`,
  ).bind(data.orgId, requestedProject).all<ActionRow>(), context.env.DB.prepare(
    `SELECT window_days FROM cue_engagement_settings WHERE org_id = ? AND project_id = ?`,
  ).bind(data.orgId, requestedProject).first<{ window_days: number }>()]);
  const windowDays = Number(setting?.window_days ?? 7);
  if ((configured.results ?? []).length) return jsonResponse(response(requestedProject, configured.results ?? [], windowDays));

  // Existing projects get an immediately useful draft from their first three
  // custom metrics; saving the form makes their ordering explicit.
  const legacy = await context.env.DB.prepare(
    `SELECT metric_key, label, NULL AS template_slot
       FROM cue_custom_metrics
      WHERE org_id = ? AND project_id = ? AND enabled = 1
      ORDER BY created_at, metric_key
      LIMIT 3`,
  ).bind(data.orgId, requestedProject).all<ActionRow>();
  const legacyRows = legacy.results ?? [];
  return jsonResponse(response(requestedProject, legacyRows.length ? legacyRows : STARTER_ACTIONS, windowDays));
}

export async function onRequestPut(context: Ctx) {
  const { data, requestedProject, matches } = scoped(context);
  if (!matches) return errorResponse("Project scope mismatch", 403);
  if (!data.isAdmin) return errorResponse("Admin required", 403);
  let raw: unknown;
  try { raw = await context.request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(ActionsSchema, raw);
  if (!parsed.ok) return parsed.response;

  const previous = await context.env.DB.prepare(
    `SELECT metric_key FROM cue_custom_metrics
      WHERE org_id = ? AND project_id = ? AND template_slot IS NOT NULL`,
  ).bind(data.orgId, requestedProject).all<{ metric_key: string }>();
  const selectedKeys = new Set(parsed.data.actions.map((action) => action.key));
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO cue_engagement_settings (org_id, project_id, window_days, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, project_id) DO UPDATE SET
         window_days = excluded.window_days, updated_by = excluded.updated_by,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    ).bind(data.orgId, requestedProject, parsed.data.windowDays, data.userLogin),
    context.env.DB.prepare(
      `UPDATE cue_custom_metrics SET template_slot = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE org_id = ? AND project_id = ? AND template_slot IS NOT NULL`,
    ).bind(data.orgId, requestedProject),
    ...(previous.results ?? []).filter((row) => !selectedKeys.has(row.metric_key)).map((row) => context.env.DB.prepare(
      `UPDATE cue_custom_metrics SET enabled = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE org_id = ? AND project_id = ? AND metric_key = ?`,
    ).bind(data.orgId, requestedProject, row.metric_key)),
  ];
  parsed.data.actions.forEach((action, index) => {
    statements.push(context.env.DB.prepare(
      `INSERT OR IGNORE INTO cue_custom_metrics
         (id, org_id, project_id, source_id, metric_key, label, created_by)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), data.orgId, requestedProject, action.key, action.label, data.userLogin));
    statements.push(context.env.DB.prepare(
      `UPDATE cue_custom_metrics
          SET label = ?, enabled = 1, template_slot = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE org_id = ? AND project_id = ? AND metric_key = ?`,
    ).bind(action.label, index + 1, data.orgId, requestedProject, action.key));
  });
  await context.env.DB.batch(statements);
  return jsonResponse(response(requestedProject, parsed.data.actions.map((action, index) => ({
    metric_key: action.key,
    label: action.label,
    template_slot: index + 1,
  })), parsed.data.windowDays));
}
