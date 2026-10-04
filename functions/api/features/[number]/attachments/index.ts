import { errorResponse, getCtx } from "../../../../lib/db";
import { callNoxTicket, type NoxTicketEnvironment } from "../../../../lib/noxticket-service";

const MAX_BYTES = 10 * 1024 * 1024;

interface Ctx {
  env: NoxTicketEnvironment;
  data: { orgId: number; projectId?: string | null; userLogin: string };
  request: Request;
  params: { number: string };
}

function featureId(context: Ctx) {
  const id = Number.parseInt(context.params.number, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin } = getCtx(context) as Ctx["data"];
  const id = featureId(context);
  if (!orgId || !projectId || !id) return errorResponse("Invalid feature scope", 400);
  return await callNoxTicket(context.env, (service) => service.listFeatureAttachments({ orgId, projectId, userLogin }, id))
    ?? errorResponse("NoxTicket attachment service is unavailable", 503);
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin } = getCtx(context) as Ctx["data"];
  const id = featureId(context);
  if (!orgId || !projectId || !userLogin || !id) return errorResponse("Invalid feature scope", 400);
  let form: FormData;
  try { form = await context.request.formData(); }
  catch { return errorResponse("Expected multipart/form-data body", 400); }
  const file = form.get("file") as unknown as { name: string; size: number; stream: () => ReadableStream } | null;
  if (!file || typeof file !== "object" || typeof file.name !== "string" || typeof file.stream !== "function") return errorResponse("Missing `file` field", 400);
  if (file.size <= 0) return errorResponse("File is empty", 400);
  if (file.size > MAX_BYTES) return errorResponse("File too large — max 10 MB", 413);
  const delegated = await callNoxTicket(context.env, async (service) => service.putFeatureAttachment(
    { orgId, projectId, userLogin }, id, file.name, await new Response(file.stream()).arrayBuffer(),
  ));
  return delegated ?? errorResponse("NoxTicket attachment service is unavailable", 503);
}
