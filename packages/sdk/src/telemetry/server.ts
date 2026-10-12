import { createClient, safeErrorDetails } from "./core.js";
import { TELEMETRY_ENVIRONMENTS } from "./contract.js";
import type { TelemetryEnvironment, TelemetryOptions, ServerTelemetryClient } from "./types.js";

export type * from "./types.js";
export { safeErrorDetails };
export { telemetryExpressErrorHandler, withTelemetry, withTelemetryPages } from "./adapters.js";
export { createTelemetrySpanProcessor } from "./otel.js";
export type { TelemetryReadableSpan, TelemetrySpanProcessor } from "./otel.js";

function runtime(): "server" | "edge" {
  return typeof navigator !== "undefined" && /Cloudflare-Workers/i.test(navigator.userAgent) ? "edge" : "server";
}

export function createTelemetry(options: TelemetryOptions): ServerTelemetryClient {
  return createClient(options, "secret", { kind: runtime() });
}

export function createTelemetryFromEnv(overrides: Partial<TelemetryOptions> = {}): ServerTelemetryClient {
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const configuredEnvironment = env.NOXHERE_ENVIRONMENT ?? env.TELEMETRY_ENVIRONMENT;
  const environment = TELEMETRY_ENVIRONMENTS.includes(configuredEnvironment as TelemetryEnvironment)
    ? configuredEnvironment as TelemetryEnvironment
    : undefined;
  return createTelemetry({
    key: env.NOXHERE_INGEST_KEY ?? env.TELEMETRY_INGEST_KEY ?? "",
    identityHashKey: env.NOXHERE_IDENTITY_HASH_KEY,
    identityKeyId: env.NOXHERE_IDENTITY_KEY_ID,
    environment,
    release: env.NOXHERE_RELEASE ?? env.GITHUB_SHA,
    endpoint: env.NOXHERE_INGEST_ENDPOINT,
    enabled: !["0", "false", "off"].includes((env.NOXHERE_TELEMETRY_ENABLED ?? "true").toLowerCase()),
    mode: ["memory", "dry-run", "test"].includes((env.NOXHERE_TELEMETRY_MODE ?? "").toLowerCase()) ? "memory" : "deliver",
    ...overrides,
  });
}
