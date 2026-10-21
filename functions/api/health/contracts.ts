import { onRequestGet as coreReadiness } from "./ready";

interface Env {
  BUILD_SHA?: string;
  DB: D1Database;
  CONNECTIONS?: Fetcher;
  TELEMETRY_RESPONSE?: Fetcher;
  ACTIVITY_RESPONSE?: Fetcher;
  PLANNING_SERVICE?: Fetcher;
  FEEDBACK_RESPONSE?: Fetcher;
  BACKGROUND_SERVICE?: Fetcher;
}

interface Context { env: Env }
interface HealthBody {
  contractVersion?: unknown;
  kind?: unknown;
  service?: unknown;
  status?: unknown;
  buildSha?: unknown;
  checks?: unknown;
}

const TIMEOUT_MS = 2_000;

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("health_contract_timeout")), TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function read(response: Response): Promise<HealthBody> {
  return response.json<HealthBody>().catch(() => ({}));
}

async function probe(serviceId: string, service: Fetcher | undefined, expectedSha: string) {
  if (!service) return { service: serviceId, live: false, ready: false, buildSha: null };
  try {
    const [liveResponse, readyResponse] = await bounded(Promise.all([
      service.fetch(new Request(`https://${serviceId}.internal/health/live`)),
      service.fetch(new Request(`https://${serviceId}.internal/health/ready`)),
    ]));
    const [live, ready] = await Promise.all([read(liveResponse), read(readyResponse)]);
    const buildSha = typeof ready.buildSha === "string" ? ready.buildSha : null;
    return {
      service: serviceId,
      live: liveResponse.ok
        && live.contractVersion === 1
        && live.kind === "liveness"
        && live.service === serviceId
        && live.status === "ok"
        && live.buildSha === expectedSha,
      ready: readyResponse.ok
        && ready.contractVersion === 1
        && ready.kind === "readiness"
        && ready.service === serviceId
        && ready.status === "ok"
        && ready.buildSha === expectedSha,
      buildSha,
    };
  } catch {
    return { service: serviceId, live: false, ready: false, buildSha: null };
  }
}

export async function onRequestGet(context: Context): Promise<Response> {
  const buildSha = context.env.BUILD_SHA ?? "development";
  const coreReadyResponse = await coreReadiness(context as never);
  const coreReady = await read(coreReadyResponse);
  const services = await Promise.all([
    probe("connections", context.env.CONNECTIONS, buildSha),
    probe("telemetry", context.env.TELEMETRY_RESPONSE, buildSha),
    probe("activity", context.env.ACTIVITY_RESPONSE, buildSha),
    probe("planning", context.env.PLANNING_SERVICE, buildSha),
    probe("feedback", context.env.FEEDBACK_RESPONSE, buildSha),
    probe("scheduler", context.env.BACKGROUND_SERVICE, buildSha),
  ]);
  services.unshift({
    service: "core-api",
    live: true,
    ready: coreReadyResponse.ok
      && coreReady.contractVersion === 1
      && coreReady.kind === "readiness"
      && coreReady.service === "core-api"
      && coreReady.status === "ok"
      && coreReady.buildSha === buildSha,
    buildSha,
  });
  const ready = services.every((service) => service.live && service.ready && service.buildSha === buildSha);
  return Response.json({
    contractVersion: 1,
    kind: "health-contracts",
    status: ready ? "ok" : "not_ready",
    buildSha,
    services,
  }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
