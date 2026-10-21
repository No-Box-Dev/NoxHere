import { readinessResponse } from "../../../packages/contracts/health";

export async function telemetryReadiness(
  env: Pick<Env, "NOX_DB" | "BUILD_SHA" | "NOX_TASKS">,
): Promise<Response> {
  let database = false;
  try {
    await env.NOX_DB.prepare(
      "SELECT id, org_id, project_id, capability, enabled FROM telemetry_sources LIMIT 1",
    ).first();
    database = true;
  } catch (error) {
    console.error(JSON.stringify({
      event: "telemetry_readiness_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return readinessResponse("telemetry", env.BUILD_SHA, {
    database,
    taskQueue: Boolean(env.NOX_TASKS),
  });
}
