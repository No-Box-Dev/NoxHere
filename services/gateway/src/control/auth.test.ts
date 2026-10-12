import { describe, expect, it } from "vitest";
import { API_TOKEN_ENVIRONMENTS, API_TOKEN_SCOPES, createApiTokenValue, requiredScope } from "./auth";

describe("developer feedback automation authorization", () => {
  it("exposes a dedicated least-privilege token scope", () => {
    expect(API_TOKEN_SCOPES).toContain("developer-feedback:write");
    expect(requiredScope("/api/v1/developer-feedback", "POST")).toBe("developer-feedback:write");
    expect(requiredScope("/api/v1/developer-feedback", "GET")).toBeNull();
  });
});

describe("Slack message automation authorization", () => {
  it("exposes a dedicated least-privilege write scope", () => {
    expect(API_TOKEN_SCOPES).toContain("slack:send");
    expect(requiredScope("/api/v1/integrations/slack/messages", "POST")).toBe("slack:send");
    expect(requiredScope("/api/v1/integrations/slack/messages", "GET")).toBeNull();
  });
});

describe("application write authorization", () => {
  it("separates ingestion and submission from management writes", () => {
    expect(API_TOKEN_SCOPES).toContain("telemetry:ingest");
    expect(API_TOKEN_SCOPES).toContain("feedback:submit");
    expect(requiredScope("/api/v1/telemetry/public/events", "POST")).toBe("telemetry:ingest");
    expect(requiredScope("/api/telemetry/public/v1/events", "POST")).toBe("telemetry:ingest");
    expect(requiredScope("/api/v1/telemetry/sources/source-1", "PUT")).toBe("telemetry:write");
    expect(requiredScope("/api/feedback/public/v1/reports", "POST")).toBe("feedback:submit");
  });

  it("creates visibly environment-bound opaque credentials", async () => {
    expect(API_TOKEN_ENVIRONMENTS).toEqual(["production", "staging", "test"]);
    await expect(createApiTokenValue("production")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_live_/) });
    await expect(createApiTokenValue("staging")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_staging_/) });
    await expect(createApiTokenValue("test")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_test_/) });
  });
});
