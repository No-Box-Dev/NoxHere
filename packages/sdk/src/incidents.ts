import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createIncidentClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).incidents;
}

export { createNoxCue, safeErrorDetails } from "./telemetry/server.js";
export type { NoxCueOptions, ServerNoxCueClient } from "./telemetry/types.js";
export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
