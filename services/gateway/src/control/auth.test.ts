import { describe, expect, it } from "vitest";
import { API_TOKEN_ENVIRONMENTS, API_TOKEN_SCOPES, createApiTokenValue, membershipVerificationIsFresh, requiredScope, type AuthContext } from "./auth";

const memberAuth = (verifiedAt: string | null): AuthContext => ({
  credentialType: "native_session",
  credentialId: "session",
  principalId: "github:42",
  userLogin: "octocat",
  userId: 42,
  orgId: 7,
  orgLogin: "acme",
  isAdmin: false,
  projectId: null,
  scopes: [],
  connectionId: "noxic_connection",
  accessLevel: "member",
  guestAccess: null,
  role: "member",
  membershipVerifiedAt: verifiedAt,
});

describe("organization membership verification", () => {
  it("expires cached membership after the native access-token window", () => {
    const now = Date.parse("2026-10-17T00:00:00Z");
    expect(membershipVerificationIsFresh(memberAuth("2026-10-16T23:46:00Z"), now)).toBe(true);
    expect(membershipVerificationIsFresh(memberAuth("2026-10-16T23:44:59Z"), now)).toBe(false);
    expect(membershipVerificationIsFresh(memberAuth(null), now)).toBe(false);
  });

  it("never treats guests as verified members", () => {
    expect(membershipVerificationIsFresh({
      ...memberAuth("2026-10-17T00:00:00Z"),
      accessLevel: "guest",
      role: "guest",
    }, Date.parse("2026-10-17T00:00:00Z"))).toBe(false);
  });
});

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
    expect(requiredScope("/api/v1/slack/test", "POST")).toBe("slack:send");
    expect(requiredScope("/api/v1/slack/channels", "GET")).toBe("slack:read");
  });
});

describe("Planning automation authorization", () => {
  it("supports project-scoped acceptance reads and writes", () => {
    expect(API_TOKEN_SCOPES).toContain("planning:read");
    expect(API_TOKEN_SCOPES).toContain("planning:write");
    expect(requiredScope("/api/v1/features", "GET")).toBe("planning:read");
    expect(requiredScope("/api/v1/features", "POST")).toBe("planning:write");
    expect(requiredScope("/api/v1/services/planning/config", "GET")).toBe("planning:read");
  });
});

describe("application write authorization", () => {
  it("allows project-scoped acceptance to verify the unified bootstrap", () => {
    expect(requiredScope("/api/v1/bootstrap", "GET")).toBe("services:read");
    expect(requiredScope("/api/v1/bootstrap", "POST")).toBeNull();
  });

  it("separates ingestion and submission from management writes", () => {
    expect(API_TOKEN_SCOPES).toContain("telemetry:ingest");
    expect(requiredScope("/api/v1/telemetry/public/events", "POST")).toBe("telemetry:ingest");
    expect(requiredScope("/api/telemetry/public/v1/events", "POST")).toBe("telemetry:ingest");
    expect(requiredScope("/api/v1/telemetry/sources/source-1", "PUT")).toBe("telemetry:write");
  });

  it("creates visibly environment-bound opaque credentials", async () => {
    expect(API_TOKEN_ENVIRONMENTS).toEqual(["production", "staging", "test"]);
    await expect(createApiTokenValue("production")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_live_/) });
    await expect(createApiTokenValue("staging")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_staging_/) });
    await expect(createApiTokenValue("test")).resolves.toMatchObject({ token: expect.stringMatching(/^nox_sk_test_/) });
  });
});
