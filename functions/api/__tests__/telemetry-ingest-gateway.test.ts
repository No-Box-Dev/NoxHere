import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../telemetry/public/v1/events";

describe("Telemetry stable ingest gateway", () => {
  it("forwards the request through the private service binding", async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/v1/events");
      expect(request.headers.get("X-Nox-Ingest-Key")).toBe("nox_secret_test");
      return Response.json({ accepted: true }, { status: 202 });
    });
    const response = await onRequest({
      env: { TELEMETRY_RESPONSE: { fetch } as unknown as Fetcher },
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": "nox_secret_test" },
        body: JSON.stringify({ type: "user.active", userId: "user-1" }),
      }),
    });
    expect(response.status).toBe(202);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("uses private RPC for an authenticated API token without forwarding the secret", async () => {
    const ingestApiTokenEvent = vi.fn(async (input) => {
      expect(input).toEqual({
        auth: {
          orgId: 7,
          projectId: "project-1",
          environment: "production",
          tokenId: "token-1",
          sourceId: "source-1",
        },
        body: JSON.stringify({ type: "user.active", userId: "h1_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
        contentType: "application/json",
        ip: "203.0.113.2",
      });
      expect(JSON.stringify(input)).not.toContain("nox_sk_");
      return Response.json({ accepted: true }, { status: 202 });
    });
    const fetch = vi.fn();
    const body = JSON.stringify({ type: "user.active", userId: "h1_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
    const response = await onRequest({
      env: { TELEMETRY_RESPONSE: { fetch, ingestApiTokenEvent } as unknown as Fetcher & { ingestApiTokenEvent: typeof ingestApiTokenEvent } },
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", {
        method: "POST",
        headers: {
          Authorization: "Bearer nox_sk_live_never-forward-this",
          "Content-Type": "application/json",
          "X-Nox-Source-ID": "source-1",
          "CF-Connecting-IP": "203.0.113.2",
        },
        body,
      }),
      data: {
        orgId: 7,
        projectId: "project-1",
        auth: { type: "api_token", id: "token-1", tokenEnvironment: "production" },
      },
    });
    expect(response.status).toBe(202);
    expect(ingestApiTokenEvent).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects API tokens presented from browser origins", async () => {
    const ingestApiTokenEvent = vi.fn();
    const response = await onRequest({
      env: { TELEMETRY_RESPONSE: { fetch: vi.fn(), ingestApiTokenEvent } as never },
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", {
        method: "POST",
        headers: { Origin: "https://example.com", "Content-Type": "application/json" },
        body: "{}",
      }),
      data: {
        orgId: 7,
        projectId: "project-1",
        auth: { type: "api_token", id: "token-1", tokenEnvironment: "production" },
      },
    });
    expect(response.status).toBe(403);
    expect(ingestApiTokenEvent).not.toHaveBeenCalled();
  });

  it("returns a retriable response when the service binding is unavailable", async () => {
    const response = await onRequest({
      env: {},
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", { method: "POST" }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ error: "ingest_unavailable" });
  });

  it("normalizes a disconnected local or unhealthy service binding", async () => {
    const response = await onRequest({
      env: {
        TELEMETRY_RESPONSE: {
          fetch: vi.fn().mockRejectedValue(new Error("binding unavailable")),
        } as unknown as Fetcher,
      },
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", { method: "POST" }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ error: "ingest_unavailable" });
  });

  it("normalizes a non-JSON binding failure response", async () => {
    const response = await onRequest({
      env: {
        TELEMETRY_RESPONSE: {
          fetch: vi.fn().mockResolvedValue(new Response("Worker not found", { status: 503 })),
        } as unknown as Fetcher,
      },
      request: new Request("https://app.noxhere.com/api/telemetry/public/v1/events", { method: "POST" }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "ingest_unavailable" });
  });
});
