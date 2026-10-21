import { describe, expect, it, vi } from "vitest";
import { onRequestGet as live } from "../health/live";
import { onRequestGet as ready } from "../health/ready";
import { onRequestGet as contracts } from "../health/contracts";

function service(serviceName: string, ok = true, buildSha = "connect-sha"): Fetcher {
  return { fetch: vi.fn(async (request: Request) => {
    const liveRequest = new URL(request.url).pathname.endsWith("/live");
    return Response.json({
      contractVersion: 1,
      kind: liveRequest ? "liveness" : "readiness",
      service: serviceName,
      status: ok ? "ok" : "not_ready",
      buildSha,
      ...(liveRequest ? {} : { checks: { dependency: ok } }),
    }, { status: ok ? 200 : 503 });
  }) } as unknown as Fetcher;
}

function telemetryService(options: { ok?: boolean; buildSha?: string; rpc?: boolean | "hang" } = {}) {
  return {
    fetch: vi.fn(async (request: Request) => {
      const liveRequest = new URL(request.url).pathname.endsWith("/live");
      return Response.json({
        contractVersion: 1,
        kind: liveRequest ? "liveness" : "readiness",
        service: "telemetry",
        status: options.ok === false ? "not_ready" : "ok",
        buildSha: options.buildSha ?? "connect-sha",
        ...(liveRequest ? {} : { checks: { database: options.ok !== false } }),
      }, { status: options.ok === false ? 503 : 200 });
    }),
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
      PLANNING_SERVICE: service("planning", options.serviceOk ?? true),
      FEEDBACK_RESPONSE: service("feedback", options.serviceOk ?? true),
      TELEMETRY_RESPONSE: telemetryService({ ok: options.serviceOk ?? true, buildSha: options.telemetryBuildSha, rpc: options.telemetryRpc }),
      ACTIVITY_RESPONSE: service("activity", options.serviceOk ?? true),
      CONNECTIONS: service("connections", options.serviceOk ?? true),
      BACKGROUND_SERVICE: service("scheduler", options.serviceOk ?? true),
    },
  } as never;
}

describe("NoxHere health", () => {
  it("returns a minimal liveness response", async () => {
    const response = live();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contractVersion: 1,
      kind: "liveness",
      service: "core-api",
      status: "ok",
      buildSha: "development",
    });
  });

  it("is ready when storage, background work, queue and product services are healthy", async () => {
    const response = await ready(context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      kind: "readiness",
      checks: { database: true, backgroundWorker: true, deliveryQueue: true, connections: true, planning: true, feedback: true, telemetry: true, activity: true, scheduler: true },
      service: "core-api",
      versions: { noxhere: "connect-sha", background: "connect-sha", connections: "connect-sha", planning: "connect-sha", feedback: "connect-sha", telemetry: "connect-sha", activity: "connect-sha", scheduler: "connect-sha" },
    });
  });

  it("publishes exact-release liveness and readiness for every private service", async () => {
    const response = await contracts(context());
    expect(response.status).toBe(200);
    const body = await response.json() as { services: Array<Record<string, unknown>> };
    expect(body).toMatchObject({
      contractVersion: 1,
      kind: "health-contracts",
      status: "ok",
      buildSha: "connect-sha",
    });
    expect(body.services).toHaveLength(7);
    expect(body.services.map(({ service }) => service)).toEqual([
      "core-api", "connections", "telemetry", "activity", "planning", "feedback", "scheduler",
    ]);
    expect(body.services.every(({ live, ready, buildSha }) => live === true && ready === true && buildSha === "connect-sha")).toBe(true);
  });

  it("fails readiness before a background heartbeat exists", async () => {
    const response = await ready(context({ heartbeat: null }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "not_ready", checks: { backgroundWorker: false } });
  });

  it("fails readiness until the deployed background release has scheduled successfully", async () => {
    const response = await ready(context({
      heartbeat: { status: "healthy", last_succeeded_at: new Date().toISOString(), release: "older-sha" },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "not_ready",
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
    expect(await response.json()).toMatchObject({ checks: { connections: false, planning: false, feedback: false, telemetry: false, activity: false, scheduler: false } });
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
