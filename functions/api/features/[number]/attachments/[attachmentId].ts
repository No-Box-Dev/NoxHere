import { errorResponse, getCtx } from "../../../../lib/db";
import { callPlanning, type PlanningEnvironment } from "../../../../lib/planning-service";

interface Ctx {
  env: PlanningEnvironment;
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
  if (!context.env.PLANNING_SERVICE) return errorResponse("Planning attachment service is unavailable", 503);
  try {
    return await context.env.PLANNING_SERVICE.getFeatureAttachment({ orgId, projectId, userLogin }, parsed.featureId, parsed.attachmentId);
  } catch (error) {
    console.error(JSON.stringify({ event: "planning_feature_attachment_get_failed", error: error instanceof Error ? error.message : String(error) }));
    return errorResponse("Planning attachment service is unavailable", 503);
  }
}

export async function onRequestDelete(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin } = getCtx(context) as Ctx["data"];
  const parsed = ids(context);
  if (!orgId || !projectId || !parsed) return errorResponse("Invalid attachment scope", 400);
  return await callPlanning(context.env, (service) => service.deleteFeatureAttachment({ orgId, projectId, userLogin }, parsed.featureId, parsed.attachmentId))
    ?? errorResponse("Planning attachment service is unavailable", 503);
}
