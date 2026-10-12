import { getCtx, jsonResponse, errorResponse } from "../../lib/db";
import { getActivityDefaultPrompt } from "../../lib/activity-response.js";

export async function onRequestGet(context) {
  const { orgId, isAdmin } = getCtx(context);
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Only an organization admin can view or change the release-notes prompt.", 403);

  try {
    const prompt = await getActivityDefaultPrompt(context.env, "release_notes");
    return jsonResponse({ prompt });
  } catch (error) {
    console.error("[noxhere] Failed to load the Activity default prompt:", error);
    return errorResponse("The built-in Activity prompt is unavailable. Refresh and try again before editing.", 503);
  }
}
