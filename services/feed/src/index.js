import { WorkerEntrypoint } from "cloudflare:workers";
import { buildPrompt, buildSlackResponse, buildTestResponse, getDefaultPrompt } from "./policy.js";
import { generateContent, generationInfo } from "./generation.js";
import { handleDemoRequest } from "./demo.js";
import { NOXFEED_SERVICE_MANIFEST, validateNoxFeedConfigPatch } from "./service.js";

export default class NoxFeedResponseService extends WorkerEntrypoint {
  describe() { return NOXFEED_SERVICE_MANIFEST; }
  validateConfigPatch(current, patch) { return validateNoxFeedConfigPatch(current, patch); }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "noxfeed-response", status: "ok" });
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
  // Rollout compatibility for NoxConnect versions deployed before complete
  // generation moved here. Remove after all callers use generate().
  buildPrompt(kind, input, systemOverride) { return buildPrompt(kind, input, systemOverride); }
  getDefaultPrompt(kind) { return getDefaultPrompt(kind); }
  buildSlackResponse(kind, input) { return buildSlackResponse(kind, input); }
  buildTestResponse(orgLogin, stream) { return buildTestResponse(orgLogin, stream); }
}
