import { describe, expect, it, vi } from "vitest";
import { handleProviderIngress, providerIngressReadiness, type ProviderIngressEnv } from "./provider-ingress";

function env(overrides: Partial<ProviderIngressEnv> = {}): ProviderIngressEnv {
  return {
    DB: {} as D1Database,
    TASK_QUEUE: {} as Queue,
    ...overrides,
  };
}

function context(request: Request, overrides: Partial<ProviderIngressEnv> = {}) {
  return { request, env: env(overrides), waitUntil: vi.fn() };
}

describe("provider ingress boundary", () => {
  it("reports each provider configuration without exposing secret values", async () => {
    const response = providerIngressReadiness(env({
      ENCRYPTION_KEY: "encryption-secret",
      GITHUB_WEBHOOK_SECRET: "github-secret",
      POSTMARK_WEBHOOK_SECRET: "postmark-secret",
      SLACK_CLIENT_ID: "client-id",
      SLACK_CLIENT_SECRET: "client-secret",
      SLACK_SIGNING_SECRET: "signing-secret",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      service: "noxhere-connections",
      status: "ok",
      dependency: "provider-ingress",
      checks: { github: true, slack: true, postmark: true },
    });
  });

  it("blocks readiness when any provider verification secret is missing", async () => {
    const response = providerIngressReadiness(env({ ENCRYPTION_KEY: "configured" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { github: false, slack: false, postmark: false },
    });
  });

  it("fails closed when Slack sends an event before its signing secret is configured", async () => {
    const response = await handleProviderIngress(context(new Request(
      "https://connections.internal/api/slack/events",
      { method: "POST", body: "{}" },
    )));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("rejects authenticated Slack operations without a gateway assertion", async () => {
    const response = await handleProviderIngress(context(new Request(
      "https://connections.internal/api/v1/slack/status",
    ), { NOXHERE_INTERNAL_SECRET: "internal-secret" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "missing_internal_assertion" },
    });
  });

  it("rejects unsupported methods and paths at the provider boundary", async () => {
    const wrongMethod = await handleProviderIngress(context(new Request(
      "https://connections.internal/api/webhook",
      { method: "GET" },
    )));
    const unknownPath = await handleProviderIngress(context(new Request(
      "https://connections.internal/api/private-data",
    )));

    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("POST");
    expect(unknownPath.status).toBe(404);
  });
});
