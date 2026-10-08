import { errorResponse, getCtx } from "../../lib/db";
import { callNoxTicket, type NoxTicketEnvironment, type NoxTicketScope, type NoxTicketServiceBinding, type NoxTicketServiceResult } from "../../lib/noxticket-service";

interface Ctx {
  env: NoxTicketEnvironment;
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin?: boolean };
  request: Request;
  params?: { id?: string };
}

function scope(context: Ctx): NoxTicketScope {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  return { orgId, projectId, userLogin, isAdmin };
}

async function callTaskService(context: Ctx, operation: (service: NoxTicketServiceBinding, caller: NoxTicketScope, id: string) => Promise<NoxTicketServiceResult>) {
  const caller = scope(context);
  const id = context.params?.id ?? "";
  if (!caller.projectId) return errorResponse("Select a project to use Planning tasks", 400);
  if (!id) return errorResponse("Invalid task id", 400);
  const delegated = await callNoxTicket(context.env, (service) => operation(service, caller, id));
  return delegated ?? Response.json({ error: "Planning tasks are unavailable", code: "service_unavailable", service: "noxticket" }, { status: 503 });
}

export async function onRequestPatch(context: Ctx): Promise<Response> {
  let input: unknown;
  try { input = await context.request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  return callTaskService(context, (service, caller, id) => service.updateTask(caller, id, input));
}

export async function onRequestDelete(context: Ctx): Promise<Response> {
  return callTaskService(context, (service, caller, id) => service.deleteTask(caller, id));
}
