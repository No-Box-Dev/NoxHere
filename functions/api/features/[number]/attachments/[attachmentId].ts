import { errorResponse, getCtx } from "../../../../lib/db";
import { callNoxTicket, type NoxTicketEnvironment } from "../../../../lib/noxticket-service";

interface Ctx {
  env: NoxTicketEnvironment;
  data: { orgId: number; projectId?: string | null; userLogin: string };
  request: Request;
  params: { number: string; attachmentId: string };
}
function ids(context: Ctx) {
  const featureId = Number.parseInt(context.params.number, 10);
  const attachmentId = Number.parseInt(context.params.attachmentId, 10);
  return Number.isInteger(featureId) && featureId > 0 && Number.isInteger(attachmentId) && attachmentId > 0 ? { featureId, attachmentId } : null;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin } = getCtx(context) as Ctx["data"];
  const parsed = ids(context);
  if (!orgId || !projectId || !parsed) return errorResponse("Invalid attachment scope", 400);
  if (!context.env.NOXTICKET_SERVICE) return errorResponse("NoxTicket attachment service is unavailable", 503);
  try {
    return await context.env.NOXTICKET_SERVICE.getFeatureAttachment({ orgId, projectId, userLogin }, parsed.featureId, parsed.attachmentId);
  } catch (error) {
    console.error(JSON.stringify({ event: "noxticket_feature_attachment_get_failed", error: error instanceof Error ? error.message : String(error) }));
    return errorResponse("NoxTicket attachment service is unavailable", 503);
  }
}

export async function onRequestDelete(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin } = getCtx(context) as Ctx["data"];
  const parsed = ids(context);
  if (!orgId || !projectId || !parsed) return errorResponse("Invalid attachment scope", 400);
  return await callNoxTicket(context.env, (service) => service.deleteFeatureAttachment({ orgId, projectId, userLogin }, parsed.featureId, parsed.attachmentId))
    ?? errorResponse("NoxTicket attachment service is unavailable", 503);
}
