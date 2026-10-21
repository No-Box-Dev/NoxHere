import { readinessResponse } from "../../../packages/contracts/health.ts";

export async function activityReadiness(env) {
  let database = false;
  try {
    await env.DEMO_DB.prepare(
      "SELECT id, type, feed_mode, source, actor_id, project_id, org, repo, payload_json FROM events LIMIT 1",
    ).first();
    database = true;
  } catch (error) {
    console.error(JSON.stringify({
      event: "activity_readiness_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return readinessResponse("activity", env.BUILD_SHA, { database });
}
