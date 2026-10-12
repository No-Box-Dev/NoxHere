import { z } from "zod";
import { getCtx, jsonResponse, errorResponse } from "../lib/db";
import { AI_MODE_DISABLED, AI_MODE_MANAGED, MANAGED_LLM } from "../lib/llm-config";
import { getActivityGenerationInfo } from "../lib/activity-response.js";
import { validate } from "../lib/validate";

interface Ctx {
  env: { DB: D1Database; ANTHROPIC_API_KEY?: string; ACTIVITY_RESPONSE?: unknown };
  data: { orgId: number; projectId?: string | null; orgLogin: string; userLogin?: string; isAdmin: boolean };
  request: Request;
}

const Body = z.object({ mode: z.enum([AI_MODE_MANAGED, AI_MODE_DISABLED]) }).strict();

function access(context: Ctx) {
  const { orgId, projectId, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return { response: errorResponse("Missing org context", 400) };
  if (!isAdmin) return { response: errorResponse("Admin required", 403) };
  return { orgId, projectId };
}

type ManagedServiceStatus = {
  provider: string;
  model: string;
  available: boolean;
};

async function managedStatus(context: Ctx) {
  let activity: ManagedServiceStatus = {
    provider: MANAGED_LLM.provider,
    model: MANAGED_LLM.model,
    available: false,
  };
  try {
    activity = await getActivityGenerationInfo(context.env);
  } catch (error) {
    console.error("[noxhere llm-settings] Activity generation info unavailable:", error);
  }

  const noxhere: ManagedServiceStatus = {
    provider: MANAGED_LLM.provider,
    model: MANAGED_LLM.model,
    available: Boolean(context.env.ANTHROPIC_API_KEY),
  };

  return {
    provider: activity.provider,
    model: activity.model,
    available: activity.available && noxhere.available,
    services: { activity, noxhere },
  };
}

function payload(mode: string | null | undefined, managed: Awaited<ReturnType<typeof managedStatus>>) {
  return {
    mode: mode ?? AI_MODE_MANAGED,
    managed,
  };
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const auth = access(context);
  if (auth.response) return auth.response;

  const row = await context.env.DB.prepare(auth.projectId
    ? "SELECT mode FROM project_ai_settings WHERE org_id = ? AND project_id = ?"
    : "SELECT mode FROM ai_settings WHERE org_id = ?")
    .bind(...(auth.projectId ? [auth.orgId, auth.projectId] : [auth.orgId]))
    .first<{ mode: string }>();
  return jsonResponse(payload(row?.mode, await managedStatus(context)));
}

export async function onRequestPut(context: Ctx): Promise<Response> {
  const auth = access(context);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Body must be JSON", 400);
  }

  const parsed = validate(Body, body);
  if (!parsed.ok) return parsed.response;
  const { mode } = parsed.data;
  const managed = await managedStatus(context);

  if (mode === AI_MODE_MANAGED && !managed.available) {
    return errorResponse("Managed AI is unavailable", 503, "dependency_unavailable");
  }

  const actor = context.data.userLogin || context.data.orgLogin || "unknown";
  await context.env.DB.batch(auth.projectId ? [
    context.env.DB.prepare(
      `INSERT INTO project_ai_settings (org_id, project_id, mode, updated_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(org_id, project_id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at`,
    ).bind(auth.orgId, auth.projectId, mode),
    context.env.DB.prepare(
      `INSERT INTO ai_settings_audit (org_id, project_id, actor_login, action, mode)
       VALUES (?, ?, ?, 'mode_changed', ?)`,
    ).bind(auth.orgId, auth.projectId, actor, mode),
  ] : [
    context.env.DB.prepare(
      `INSERT INTO ai_settings (org_id, mode, updated_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(org_id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at`,
    ).bind(auth.orgId, mode),
    context.env.DB.prepare(
      `INSERT INTO ai_settings_audit (org_id, actor_login, action, mode)
       VALUES (?, ?, 'mode_changed', ?)`,
    ).bind(auth.orgId, actor, mode),
  ]);

  return jsonResponse(payload(mode, managed));
}
