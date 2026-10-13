import { createTelemetry } from "../../../packages/sdk/src/telemetry/server.js";

const ENDPOINT = "https://telemetry.internal/v1/events";

function serviceFetch(service) {
  return (input, init) => service.fetch(input instanceof Request ? input : new Request(input, init));
}

function safeOperation(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80) || "unknown";
}

export function isTenantConfigurationFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /github api error:\s*(401|403|404)\b/i.test(message);
}

export async function reportTelemetryRuntimeFailure(env, error, options = {}) {
  const key = env.TELEMETRY_INGEST_KEY?.trim();
  if (!env.TELEMETRY_INGEST || !key) return null;
  const operation = safeOperation(options.operation);
  const errorKind = safeOperation(error?.code ?? error?.name ?? "error");
  try {
    const client = createTelemetry({
      key,
      environment: "production",
      endpoint: ENDPOINT,
      release: env.CF_VERSION_METADATA?.id,
      fetch: serviceFetch(env.TELEMETRY_INGEST),
    });
    return await client.error(error, {
      title: options.title ?? `NoxHere ${operation} failed`,
      message: options.message ?? "A NoxHere background operation failed and needs attention.",
      component: options.component ?? "noxhere.background-worker",
      fingerprint: `noxhere.runtime|background-worker|${operation}|${errorKind}`,
      fatal: false,
      unhandled: true,
      attributes: { operation, errorKind },
    });
  } catch (reportingError) {
    console.error("[noxhere-background] Telemetry reporting failed:", reportingError?.message ?? reportingError);
    return null;
  }
}
