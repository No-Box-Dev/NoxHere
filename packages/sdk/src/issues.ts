import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createIssuesClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).issues;
}

export type { NoxHereOptions, OperationInput, OperationOutput, ResourceClient } from "./client.js";
