import { createClient, safeErrorDetails } from "./core.js";
import { NOXCUE_ENVIRONMENTS } from "./contract.js";
import type { NoxCueEnvironment, NoxCueOptions, ServerNoxCueClient } from "./types.js";

export type * from "./types.js";
export { safeErrorDetails };
export { noxCueExpressErrorHandler, withNoxCue, withNoxCuePages } from "./adapters.js";
export { createNoxCueSpanProcessor } from "./otel.js";
export type { NoxCueReadableSpan, NoxCueSpanProcessor } from "./otel.js";

function runtime(): "server" | "edge" {
  return typeof navigator !== "undefined" && /Cloudflare-Workers/i.test(navigator.userAgent) ? "edge" : "server";
}

export function createNoxCue(options: NoxCueOptions): ServerNoxCueClient {
  return createClient(options, "secret", { kind: runtime() });
}

export function createNoxCueFromEnv(overrides: Partial<NoxCueOptions> = {}): ServerNoxCueClient {
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const configuredEnvironment = env.NOXHERE_ENVIRONMENT ?? env.NOXCUE_ENVIRONMENT;
  const environment = NOXCUE_ENVIRONMENTS.includes(configuredEnvironment as NoxCueEnvironment)
    ? configuredEnvironment as NoxCueEnvironment
    : undefined;
  return createNoxCue({
    key: env.NOXHERE_INGEST_KEY ?? env.NOXCUE_INGEST_KEY ?? "",
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
