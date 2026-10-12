import { errorResponse, getCtx } from "../lib/db";
import { callNoxTicket, type NoxTicketEnvironment, type NoxTicketScope, type NoxTicketServiceBinding, type NoxTicketServiceResult } from "../lib/noxticket-service";

interface Ctx {
  env: NoxTicketEnvironment;
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin?: boolean };
  request: Request;
}

function scope(context: Ctx): NoxTicketScope {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  return { orgId, projectId, userLogin, isAdmin };
}

async function callWorkflowService(context: Ctx, operation: (service: NoxTicketServiceBinding, caller: NoxTicketScope) => Promise<NoxTicketServiceResult>) {
  const caller = scope(context);
  if (!caller.projectId) return errorResponse("Select a project to use personal task workflows", 400);
  const delegated = await callNoxTicket(context.env, (service) => operation(service, caller));
  return delegated ?? Response.json({ error: "Personal task workflows are unavailable", code: "service_unavailable", service: "noxticket" }, { status: 503 });
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const owner = new URL(context.request.url).searchParams.get("owner") || undefined;
  return callWorkflowService(context, (service, caller) => service.getTaskWorkflow(caller, owner));
}

export async function onRequestPut(context: Ctx): Promise<Response> {
  let input: unknown;
  try { input = await context.request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  const body = input && typeof input === "object" ? input as { owner?: unknown; stages?: unknown } : {};
  const owner = typeof body.owner === "string" ? body.owner : scope(context).userLogin;
  return callWorkflowService(context, (service, caller) => service.putTaskWorkflow(caller, owner, { stages: body.stages }));
}
