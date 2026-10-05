import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createIncidentClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).incidents;
}

export { createNoxCue, safeErrorDetails } from "@noxcue/sdk/server";
export type { NoxHereOptions, OperationInput, ResourceClient } from "./client.js";
