const CONTRACT = "activity.response";
const VERSION = 1;
const MAX_SLACK_PAYLOAD_BYTES = 64_000;

export async function generateActivityContent(env, kind, input, systemOverride) {
  const service = requireMethod(env, "generate");
  const response = await service.generate(kind, input, systemOverride);
  requireContract(response);
  const generation = response.generation;
  if (!plainObject(generation) || !["generated", "unavailable"].includes(generation.status) ||
      typeof generation.model !== "string" || !generation.model || generation.model.length > 200) {
    throw new Error("Invalid Activity generation response");
  }
  if (generation.status === "unavailable") {
    if (typeof generation.errorCode !== "string" || !generation.errorCode || generation.errorCode.length > 200) {
      throw new Error("Invalid Activity unavailable response");
    }
    return generation;
  }
  if (!plainObject(generation.output) || typeof generation.output.summary !== "string" ||
      !generation.output.summary || generation.output.summary.length > 2_400) {
    throw new Error("Invalid Activity generated output");
  }
  if (kind !== "release_notes" && (typeof generation.output.technicalSummary !== "string" ||
      !generation.output.technicalSummary || generation.output.technicalSummary.length > 1_200)) {
    throw new Error("Invalid Activity technical output");
  }
  return generation;
}

export async function getActivityGenerationInfo(env) {
  const service = requireMethod(env, "generationInfo");
  const response = await service.generationInfo();
  requireContract(response);
  if (typeof response.model !== "string" || !response.model || response.model.length > 200 ||
      typeof response.provider !== "string" || !response.provider || response.provider.length > 100 ||
      typeof response.available !== "boolean") {
    throw new Error("Invalid Activity generation info");
  }
  return { model: response.model, provider: response.provider, available: response.available };
}

export async function getActivityDefaultPrompt(env, kind) {
  const service = requireMethod(env, "getDefaultPrompt");
  const response = await service.getDefaultPrompt(kind);
  requireContract(response);
  const system = response?.prompt?.system;
  if (typeof system !== "string" || !system || system.length > 20_000) {
    throw new Error("Invalid Activity default prompt response");
  }
  return system;
}

export async function getActivitySlackResponse(env, kind, input) {
  const service = requireMethod(env, "buildSlackResponse");
  return validateSlack(await service.buildSlackResponse(kind, input));
}

export async function getActivityTestResponse(env, orgLogin, stream) {
  const service = requireMethod(env, "buildTestResponse");
  return validateSlack(await service.buildTestResponse(orgLogin, stream));
}

function requireMethod(env, method) {
  const service = env?.ACTIVITY_RESPONSE;
  if (!service || typeof service[method] !== "function") {
    throw new Error(`Activity ${method} service binding is unavailable`);
  }
  return service;
}

function validateSlack(response) {
  requireContract(response);
  const message = response.message;
  if (!plainObject(message) || typeof message.text !== "string" || !message.text || message.text.length > 4_000 || !Array.isArray(message.blocks) || message.blocks.length < 1 || message.blocks.length > 50) {
    throw new Error("Invalid Activity Slack message");
  }
  if (new TextEncoder().encode(JSON.stringify(message)).byteLength > MAX_SLACK_PAYLOAD_BYTES) throw new Error("Activity Slack message is too large");
  return response;
}

function requireContract(response) {
  if (!plainObject(response) || response.contract !== CONTRACT || response.version !== VERSION) throw new Error("Unsupported Activity response contract");
}

function plainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
