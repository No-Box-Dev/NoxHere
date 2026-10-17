import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createUsageClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).usage;
}

export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
