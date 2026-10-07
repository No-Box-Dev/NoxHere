import { describe, expect, it } from "vitest";
import { API_TOKEN_SCOPES, requiredScope } from "./auth";

describe("developer feedback automation authorization", () => {
  it("exposes a dedicated least-privilege token scope", () => {
    expect(API_TOKEN_SCOPES).toContain("developer-feedback:write");
    expect(requiredScope("/api/v1/developer-feedback", "POST")).toBe("developer-feedback:write");
    expect(requiredScope("/api/v1/developer-feedback", "GET")).toBeNull();
  });
});

describe("Slack message automation authorization", () => {
  it("exposes a dedicated least-privilege write scope", () => {
    expect(API_TOKEN_SCOPES).toContain("slack:write");
    expect(requiredScope("/api/v1/integrations/slack/messages", "POST")).toBe("slack:write");
    expect(requiredScope("/api/v1/integrations/slack/messages", "GET")).toBeNull();
  });
});
