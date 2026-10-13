import { describe, expect, it, vi } from "vitest";
import { onRequestGet as live } from "../health/live";
import { onRequestGet as ready } from "../health/ready";

function service(ok = true, buildSha = "service-sha"): Fetcher {
  return { fetch: vi.fn(async () => Response.json({ buildSha }, { status: ok ? 200 : 503 })) } as unknown as Fetcher;
}

function telemetryService(options: { ok?: boolean; buildSha?: string; rpc?: boolean | "hang" } = {}) {
  return {
    fetch: vi.fn(async () => Response.json(
      { buildSha: options.buildSha ?? "connect-sha" },
      { status: options.ok === false ? 503 : 200 },
    )),
    ...(options.rpc === false ? {} : {
      buildGitHubIncident: options.rpc === "hang"
        ? vi.fn(() => new Promise(() => undefined))
        : vi.fn(async () => ({
            contract: "telemetry.response",
            kind: "github_incident",
            marker: "<!-- telemetry-key: production/readiness/synthetic -->",
            body: "Synthetic readiness probe",
          })),
    }),
  };
}

function context(options: {
  heartbeat?: { status: string; last_succeeded_at: string; release?: string } | null;
  stale?: number;
  dbError?: boolean;
  serviceOk?: boolean;
  telemetryBuildSha?: string;
  telemetryRpc?: boolean | "hang";
} = {}) {
  const heartbeat = options.heartbeat === undefined
    ? { status: "healthy", last_succeeded_at: new Date().toISOString(), release: "connect-sha" }
    : options.heartbeat;
  const prepare = vi.fn((sql: string) => ({
    first: vi.fn(async () => {
      if (options.dbError) throw new Error("database unavailable");
      return sql.includes("service_heartbeats") ? heartbeat : { count: options.stale ?? 0 };
    }),
  }));
  return {
    env: {
      DB: { prepare },
      BUILD_SHA: "connect-sha",
      PLANNING_SERVICE: service(options.serviceOk ?? true),
      FEEDBACK_RESPONSE: service(options.serviceOk ?? true),
      TELEMETRY_RESPONSE: telemetryService({ ok: options.serviceOk ?? true, buildSha: options.telemetryBuildSha, rpc: options.telemetryRpc }),
      ACTIVITY_RESPONSE: service(options.serviceOk ?? true),
    },
  } as never;
}

describe("NoxHere health", () => {
  it("returns a minimal liveness response", async () => {
    const response = live();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ service: "noxhere", status: "ok" });
  });

  it("is ready when storage, background work, queue and product services are healthy", async () => {
    const response = await ready(context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      checks: { database: true, backgroundWorker: true, deliveryQueue: true, planning: true, feedback: true, telemetry: true, activity: true },
      service: "noxhere",
      versions: { noxhere: "connect-sha", background: "connect-sha", planning: "service-sha", feedback: "service-sha", telemetry: "connect-sha", activity: "service-sha" },
    });
  });

  it("reports degraded without failing HTTP readiness before a background heartbeat exists", async () => {
    const response = await ready(context({ heartbeat: null }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "degraded", checks: { backgroundWorker: false } });
  });

  it("reports degraded until the deployed background release has scheduled successfully", async () => {
    const response = await ready(context({
      heartbeat: { status: "healthy", last_succeeded_at: new Date().toISOString(), release: "older-sha" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      checks: { backgroundWorker: false },
      versions: { background: "older-sha" },
    });
  });

  it("is not ready for a stuck durable delivery even when the background heartbeat is stale", async () => {
    const response = await ready(context({
      heartbeat: { status: "healthy", last_succeeded_at: new Date(Date.now() - 80 * 60 * 1000).toISOString() },
      stale: 1,
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "not_ready", checks: { backgroundWorker: false, deliveryQueue: false } });
  });

  it("fails closed without exposing database errors", async () => {
    const response = await ready(context({ dbError: true }));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain("database unavailable");
  });

  it("is not ready when a required product service is unavailable", async () => {
    const response = await ready(context({ serviceOk: false }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { planning: false, feedback: false, telemetry: false, activity: false } });
  });

  it("is not ready when Telemetry lacks the required incident RPC", async () => {
    const response = await ready(context({ telemetryRpc: false }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { telemetry: false } });
  });

  it("is not ready when Telemetry is from a different release", async () => {
    const response = await ready(context({ telemetryBuildSha: "older-sha" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { telemetry: false }, versions: { telemetry: "older-sha" } });
  });

  it("fails readiness promptly when the Telemetry incident RPC hangs", async () => {
    vi.useFakeTimers();
    try {
      const pending = ready(context({ telemetryRpc: "hang" }));
      await vi.advanceTimersByTimeAsync(2_000);
      const response = await pending;
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ checks: { telemetry: false } });
    } finally {
      vi.useRealTimers();
    }
  });
});
