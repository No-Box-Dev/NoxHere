import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createIncidentClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).incidents;
}

export { createTelemetry, safeErrorDetails } from "./telemetry/server.js";
export type { TelemetryOptions, ServerTelemetryClient } from "./telemetry/types.js";
export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
