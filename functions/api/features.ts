// /api/features — list and create a project's features. NoxTicket owns the data.
// PATCH and DELETE for a single feature live in features/[number].ts.

import { getCtx, errorResponse } from "../lib/db";
import { callFeatureService, delegateFeatureMutation } from "../lib/noxticket-features";
import type { NoxTicketEnvironment } from "../lib/noxticket-service";

interface Ctx {
  env: NoxTicketEnvironment & { DB: D1Database; TASK_QUEUE: Queue };
  data: { orgId: number; projectId?: string | null; orgLogin: string; userLogin: string; isAdmin?: boolean };
  request: Request;
}

function scope(context: Ctx) {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  return { orgId, projectId, userLogin, isAdmin };
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const state = new URL(context.request.url).searchParams.get("state") || "open";
  const caller = scope(context);
  return callFeatureService(context.env, caller, (service) => service.listFeatures(caller, state));
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  let body: unknown;
  try { body = await context.request.json(); } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const caller = scope(context);
  const delegated = await delegateFeatureMutation(
    context.env,
    caller,
    context.request,
    "create",
    undefined,
    body,
    context.data.orgLogin,
  );
  return delegated ?? callFeatureService(context.env, caller, (service) => service.createFeature(caller, body));
}
