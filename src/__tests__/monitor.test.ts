import { describe, expect, it, vi } from "vitest";
import { isSafePublicUrl, nextEndpointState, probeEndpoint, testEndpointMonitor } from "../monitor";

describe("endpoint URL safety", () => {
  it.each([
    "http://example.com/health",
    "https://localhost/health",
    "https://service.internal/health",
    "https://127.0.0.1/health",
    "https://[::1]/health",
    "https://user:password@example.com/health",
    "https://example.com:8443/health",
  ])("rejects %s", (url) => expect(isSafePublicUrl(url)).toBe(false));

  it("accepts a normal public HTTPS endpoint", () => {
    expect(isSafePublicUrl("https://api.example.com/health")).toBe(true);
  });
});

describe("endpoint probing", () => {
  it("follows only validated HTTPS redirects and discards bodies", async () => {
    const cancel = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "/ready" } }))
      .mockResolvedValueOnce({ status: 204, headers: new Headers(), body: { cancel } } as unknown as Response);
    let clock = 100;
    const result = await probeEndpoint("https://api.example.com/health", fetcher, () => (clock += 25));
    expect(result).toEqual({ healthy: true, statusCode: 204, latencyMs: 25, error: null });
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://api.example.com/ready", expect.objectContaining({ redirect: "manual" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("refuses redirects to private or insecure destinations", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/admin" } }),
    );
    await expect(probeEndpoint("https://api.example.com/health", fetcher, () => 1))
      .resolves.toMatchObject({ healthy: false, statusCode: 302, error: "Redirected to an unsafe URL" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("treats non-2xx responses as failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(probeEndpoint("https://api.example.com/health", fetcher, () => 1))
      .resolves.toMatchObject({ healthy: false, statusCode: 503, error: "HTTP 503" });
  });
});

describe("endpoint incident confirmation", () => {
  const at = "2026-09-03T12:00:00.000Z";

  it("requires two failures to open an incident", () => {
    const first = nextEndpointState({ status: "healthy", consecutiveFailures: 0, consecutiveSuccesses: 3, incidentStartedAt: null }, false, at);
    expect(first).toMatchObject({ status: "healthy", consecutiveFailures: 1, consecutiveSuccesses: 0 });
    const second = nextEndpointState({ status: first.status, consecutiveFailures: 1, consecutiveSuccesses: 0, incidentStartedAt: null }, false, at);
    expect(second).toMatchObject({ status: "issue", consecutiveFailures: 2, incidentStartedAt: at });
  });

  it("requires two successes to recover an incident", () => {
    const first = nextEndpointState({ status: "issue", consecutiveFailures: 2, consecutiveSuccesses: 0, incidentStartedAt: at }, true, at);
    expect(first).toMatchObject({ status: "issue", consecutiveSuccesses: 1, incidentStartedAt: at });
    const second = nextEndpointState({ status: first.status, consecutiveFailures: 0, consecutiveSuccesses: 1, incidentStartedAt: at }, true, at);
    expect(second).toMatchObject({ status: "healthy", consecutiveSuccesses: 2, incidentStartedAt: null });
  });
});

describe("manual delivery verification", () => {
  it("uses the latest scheduled result instead of creating a nested probe", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const row = {
      org_id: 7, owner_id: "acme", source_id: "source-1", source_name: "Playnist",
      url: "https://app.example.com/health", status: "healthy", consecutive_failures: 0,
      consecutive_successes: 4, incident_started_at: null, last_checked_at: new Date().toISOString(),
      last_status_code: 200, last_latency_ms: 86, last_error: null,
      slack_channel_id: "C123", slack_connection_id: "connection-1",
    };
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => row),
        run: vi.fn(async () => ({ meta: { changes: sql.includes("INSERT OR IGNORE") ? 1 : 1 } })),
      };
      return statement;
    });
    const queue = { send: vi.fn(async () => undefined) };

    const result = await testEndpointMonitor({ NOX_DB: { prepare }, NOX_TASKS: queue } as unknown as Env, 7, "source-1");

    expect(result).toMatchObject({ healthy: true, statusCode: 200, latencyMs: 86, queued: true, checkedAt: row.last_checked_at });
    expect(fetcher).not.toHaveBeenCalled();
    expect(queue.send).toHaveBeenCalledOnce();
    fetcher.mockRestore();
  });
});
