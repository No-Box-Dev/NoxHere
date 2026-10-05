import { createNoxHere, type NoxHereOptions } from "./client.js";

export function createFeedbackClient(options: NoxHereOptions = {}) {
  return createNoxHere(options).feedback;
}

export type { NoxHereOptions, OperationInput, ResourceClient } from "./client.js";
