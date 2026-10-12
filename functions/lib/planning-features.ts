import { callPlanning, serviceResultResponse, type PlanningEnvironment, type PlanningScope, type PlanningServiceBinding, type PlanningServiceResult } from "./planning-service";
import { stagePlanningFeatureAdded } from "./planning-slack.js";
import { recordFailure } from "./op-failures.js";

type Environment = PlanningEnvironment & { DB?: D1Database; TASK_QUEUE?: Queue };

function unavailable(error: unknown) {
  console.error(JSON.stringify({ event: "planning_feature_service_failed", error: error instanceof Error ? error.message : String(error) }));
  return Response.json({ error: "Planning is temporarily unavailable", code: "service_unavailable", service: "planning" }, { status: 503 });
}

// Features are owned by the Planning service (its own D1, scoped per project).
// NoxHere only authenticates the caller and forwards the request.
export async function callFeatureService(
  env: PlanningEnvironment,
  scope: PlanningScope,
  operation: (service: PlanningServiceBinding) => Promise<PlanningServiceResult>,
): Promise<Response> {
  if (!scope.projectId) return Response.json({ error: "Select a project to use Planning features" }, { status: 400 });
  const response = await callPlanning(env, operation);
  if (response) return response;
  console.error(JSON.stringify({ event: "planning_feature_service_missing" }));
  return Response.json({ error: "Planning is not available in this environment", code: "service_unavailable", service: "planning" }, { status: 503 });
}

export async function delegateFeatureMutation(
  env: Environment,
  scope: PlanningScope,
  _request: Request,
  operation: "create" | "update" | "close",
  number?: number,
  input?: unknown,
  deliveryOwnerId?: string,
): Promise<Response | null> {
  if (env.NOXHERE_LOCAL_MONOLITH === "1") return null;
  const service = env.PLANNING_SERVICE;
  if (!service || !scope.projectId) return null;
  try {
    const result: PlanningServiceResult = operation === "create"
      ? await service.createFeature(scope, input)
      : await service.updateFeature(scope, number!, operation === "close" ? { state: "closed" } : input);
    if (operation === "create" && result.ok && result.data && env.DB) {
      try {
        await stagePlanningFeatureAdded(env, {
          orgId: scope.orgId,
          projectId: scope.projectId,
          ownerId: deliveryOwnerId ?? null,
          feature: result.data,
          actor: scope.userLogin,
        });
      } catch (error) {
        console.error(JSON.stringify({
          event: "planning_feature_added_delivery_failed",
          projectId: scope.projectId,
          error: error instanceof Error ? error.message : String(error),
        }));
        await recordFailure(env.DB, {
          ownerId: deliveryOwnerId,
          op: "planning_feature_added_delivery",
          deliveryId: `${scope.projectId}:${(result.data as { number?: unknown }).number ?? "unknown"}:created`,
          error,
        });
      }
    }
    if (operation === "close" && result.ok) return Response.json({ ok: true });
    return serviceResultResponse(result);
  } catch (error) {
    return unavailable(error);
  }
}
