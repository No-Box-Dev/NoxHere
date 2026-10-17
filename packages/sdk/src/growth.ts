import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createGrowthClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).growth;
}

export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
