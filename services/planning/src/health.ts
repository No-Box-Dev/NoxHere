import { readinessResponse } from "../../../packages/contracts/health";
import { checkReadiness } from "./readiness";

export async function planningReadiness(
  env: Pick<Env, "DB" | "SPEC_ATTACHMENTS" | "BUILD_SHA">,
): Promise<Response> {
  try {
    const result = await checkReadiness(env.DB, env.BUILD_SHA);
    return readinessResponse("planning", env.BUILD_SHA, {
      database: true,
      schemaV3: result.schemaVersion === 3,
      attachments: Boolean(env.SPEC_ATTACHMENTS),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "planning_readiness_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return readinessResponse("planning", env.BUILD_SHA, {
      database: false,
      schemaV3: false,
      attachments: Boolean(env.SPEC_ATTACHMENTS),
    });
  }
}
