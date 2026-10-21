import { livenessResponse } from "../../../packages/contracts/health";

interface Context { env?: { BUILD_SHA?: string } }

export function onRequestGet(context?: Context): Response {
  return livenessResponse("core-api", context?.env?.BUILD_SHA);
}
