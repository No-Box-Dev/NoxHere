import { describe, expect, it } from "vitest";
import { matchesGatewayRoute, PLATFORM_GATEWAY_MANIFEST } from "./platform-service-manifest";

describe("generated gateway route manifest", () => {
  it("routes provider ingress only through exact owned paths", () => {
    expect(matchesGatewayRoute("providerIngress", "/api/slack/events")).toBe(true);
    expect(matchesGatewayRoute("providerIngress", "/api/slack/events/extra")).toBe(false);
    expect(matchesGatewayRoute("providerIngress", "/api/v1/bootstrap")).toBe(false);
  });

  it("keeps Slack tests out of authenticated provider routing", () => {
    expect(matchesGatewayRoute("authenticatedProvider", "/api/v1/slack/channels")).toBe(true);
    expect(matchesGatewayRoute("authenticatedProvider", "/api/v1/slack/test")).toBe(false);
    expect(matchesGatewayRoute("authenticatedProvider", "/api/integrations/connections/github/start")).toBe(true);
  });

  it("keeps Wrangler worker-first paths in the generated artifact", () => {
    expect(PLATFORM_GATEWAY_MANIFEST.runWorkerFirst).toContain("/api/*");
    expect(PLATFORM_GATEWAY_MANIFEST.runWorkerFirst).toContain("/auth/github/callback");
    expect(PLATFORM_GATEWAY_MANIFEST.runWorkerFirst).toContain("/widget/*");
  });
});
