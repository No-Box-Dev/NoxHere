import { createTelemetry } from "../../packages/sdk/src/telemetry/server.js";

interface TelemetryEnv {
  TELEMETRY_INGEST?: Fetcher;
  TELEMETRY_INGEST_KEY?: string;
  NOXHERE_IDENTITY_HASH_KEY?: string;
  NOXHERE_IDENTITY_KEY_ID?: string;
}

interface TelemetryContext {
  env: TelemetryEnv;
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const TELEMETRY_ENDPOINT = "https://telemetry.internal/v1/events";
const TELEMETRY_PUBLIC_INGEST_PATHS = new Set([
  "/api/telemetry/public/v1/events",
  "/api/v1/telemetry/public/events",
  "/api/health/live",
  "/api/health/ready",
]);

function serviceFetch(service: Fetcher): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return service.fetch(request);
  }) as typeof fetch;
}

export function createTelemetryServer(env: TelemetryEnv, key = env.TELEMETRY_INGEST_KEY?.trim()) {
  if (!env.TELEMETRY_INGEST || !key) return null;
  return createTelemetry({
    key,
    identityHashKey: env.NOXHERE_IDENTITY_HASH_KEY,
    identityKeyId: env.NOXHERE_IDENTITY_KEY_ID,
    environment: "production",
    endpoint: TELEMETRY_ENDPOINT,
    fetch: serviceFetch(env.TELEMETRY_INGEST),
  });
}

export function normalizedIncidentRoute(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id")
    .replace(/\/[0-9a-f]{32,}(?=\/|$)/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .slice(0, 160);
}

export function reportTelemetryHttpFailure(
  context: TelemetryContext,
  error: unknown,
  status?: number,
): Promise<unknown> | null {
  const url = new URL(context.request.url);
  if (TELEMETRY_PUBLIC_INGEST_PATHS.has(url.pathname)) return null;
  const client = createTelemetryServer(context.env);
  if (!client) return null;
  const route = normalizedIncidentRoute(url.pathname);
  const method = context.request.method.toUpperCase();
  const evidence = error ?? Object.assign(new Error(`HTTP ${status ?? 500} returned by the API handler`), {
    name: "HTTPResponseError",
    code: `HTTP_${status ?? 500}`,
    status: status ?? 500,
  });
  const delivery = client.error(evidence, {
    title: `NoxHere ${method} ${route} failed`,
    message: "A NoxHere API request returned an unexpected server error.",
    component: "noxhere.pages-api",
    fingerprint: `noxhere.http|${method}|${route}|${status ?? "exception"}`,
    url: `${url.origin}${url.pathname}`,
    fatal: false,
    unhandled: true,
    attributes: { method, route, ...(status === undefined ? {} : { status }) },
  });
  try { context.waitUntil?.(delivery); } catch { /* reporting must not affect the request */ }
  return delivery;
}
