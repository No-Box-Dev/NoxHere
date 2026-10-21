import { WorkerEntrypoint } from "cloudflare:workers";
import { buildPrompt, buildSlackResponse, buildTestResponse, getDefaultPrompt } from "./policy.js";
import { generateContent, generationInfo } from "./generation.js";
import { handleDemoRequest } from "./demo.js";
import { ACTIVITY_SERVICE_MANIFEST, validateActivityConfigPatch } from "./service.js";
import { livenessResponse } from "../../../packages/contracts/health.ts";
import { activityReadiness } from "./health.js";

export { activityReadiness } from "./health.js";

export default class ActivityResponseService extends WorkerEntrypoint {
  describe() { return ACTIVITY_SERVICE_MANIFEST; }
  validateConfigPatch(current, patch) { return validateActivityConfigPatch(current, patch); }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health/live") {
      return livenessResponse("activity", this.env.BUILD_SHA);
    }
    if (request.method === "GET" && (url.pathname === "/health/ready" || url.pathname === "/health")) {
      return activityReadiness(this.env);
    }
    if (url.pathname === "/api/demo/session" || url.pathname.startsWith("/api/")) {
      return handleDemoRequest(request, this.env.DEMO_DB);
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  generate(kind, input, systemOverride) {
    return generateContent(kind, input, systemOverride, this.env.ANTHROPIC_API_KEY);
  }
  generationInfo() { return generationInfo(Boolean(this.env.ANTHROPIC_API_KEY)); }
  // Rollout compatibility for NoxHere versions deployed before complete
  // generation moved here. Remove after all callers use generate().
  buildPrompt(kind, input, systemOverride) { return buildPrompt(kind, input, systemOverride); }
  getDefaultPrompt(kind) { return getDefaultPrompt(kind); }
  buildSlackResponse(kind, input) { return buildSlackResponse(kind, input); }
  buildTestResponse(orgLogin, stream) { return buildTestResponse(orgLogin, stream); }
}
