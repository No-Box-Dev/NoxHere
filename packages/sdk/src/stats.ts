import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createStatsClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).stats;
}

export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
