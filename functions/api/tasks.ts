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

async function callTaskService(context: Ctx, operation: (service: NoxTicketServiceBinding, caller: NoxTicketScope) => Promise<NoxTicketServiceResult>) {
  const caller = scope(context);
  if (!caller.projectId) return errorResponse("Select a project to use Planning tasks", 400);
  const delegated = await callNoxTicket(context.env, (service) => operation(service, caller));
  return delegated ?? Response.json({ error: "Planning tasks are unavailable", code: "service_unavailable", service: "noxticket" }, { status: 503 });
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const params = new URL(context.request.url).searchParams;
  const rawFeature = params.get("featureNumber");
  const featureNumber = rawFeature === "general" ? "general" : rawFeature ? Number(rawFeature) : undefined;
  if (typeof featureNumber === "number" && (!Number.isInteger(featureNumber) || featureNumber <= 0)) return errorResponse("Invalid feature number", 400);
  const status = params.get("status") ?? "all";
  if (status !== "all" && status !== "open" && status !== "completed") return errorResponse("Invalid task status", 400);
  return callTaskService(context, (service, caller) => service.listTasks(caller, { owner: params.get("owner") || undefined, status, featureNumber }));
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  let input: unknown;
  try { input = await context.request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
  return callTaskService(context, async (service, caller) => service.createTask(caller, input));
}
