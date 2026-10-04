import { serviceResultResponse, type NoxTicketEnvironment, type NoxTicketScope, type NoxTicketServiceResult } from "./noxticket-service";
import { stageNoxTicketFeatureAdded } from "./noxticket-slack.js";
import { recordFailure } from "./op-failures.js";

type Environment = NoxTicketEnvironment & { DB?: D1Database; TASK_QUEUE?: Queue };

function unavailable(error: unknown) {
  console.error(JSON.stringify({ event: "noxticket_feature_service_failed", error: error instanceof Error ? error.message : String(error) }));
  return Response.json({ error: "NoxTicket is temporarily unavailable", code: "service_unavailable", service: "noxticket" }, { status: 503 });
}

export async function delegateFeatureList(env: Environment, scope: NoxTicketScope, state: string): Promise<Response | null> {
  // The split service is project-native. Organization-wide compatibility is
  // served by NoxConnect's local projection until that RPC supports an
  // optional project boundary too.
  if (env.NOXHERE_LOCAL_MONOLITH === "1" || !env.NOXTICKET_SERVICE || !scope.projectId) return null;
  try { return serviceResultResponse(await env.NOXTICKET_SERVICE.listFeatures(scope, state)); }
  catch (error) { return unavailable(error); }
}

export async function delegateFeatureMutation(
  env: Environment,
  scope: NoxTicketScope,
  _request: Request,
  operation: "create" | "update" | "close",
  number?: number,
  input?: unknown,
  deliveryOwnerId?: string,
): Promise<Response | null> {
  if (env.NOXHERE_LOCAL_MONOLITH === "1") return null;
  const service = env.NOXTICKET_SERVICE;
  if (!service || !scope.projectId) return null;
  try {
    const result: NoxTicketServiceResult = operation === "create"
      ? await service.createFeature(scope, input)
      : await service.updateFeature(scope, number!, operation === "close" ? { state: "closed" } : input);
    if (operation === "create" && result.ok && result.data && env.DB) {
      try {
        await stageNoxTicketFeatureAdded(env, {
          orgId: scope.orgId,
          projectId: scope.projectId,
          ownerId: deliveryOwnerId ?? null,
          feature: result.data,
          actor: scope.userLogin,
        });
      } catch (error) {
        console.error(JSON.stringify({
          event: "noxticket_feature_added_delivery_failed",
          projectId: scope.projectId,
          error: error instanceof Error ? error.message : String(error),
        }));
        await recordFailure(env.DB, {
          ownerId: deliveryOwnerId,
          op: "noxticket_feature_added_delivery",
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
