import { onRequest as ingestTelemetryEvent } from "../../telemetry/public/v1/events";

interface IngestContext {
  env: { TELEMETRY_RESPONSE?: Fetcher };
  request: Request;
  data?: { auth?: { type?: string }; [key: string]: unknown };
}

const GROWTH_EVENT = /^(website\.|subscription\.)/;

export async function onRequest(context: IngestContext): Promise<Response> {
  if (context.request.method === "OPTIONS") return ingestTelemetryEvent(context as Parameters<typeof ingestTelemetryEvent>[0]);
  if (context.request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } });
  if (!context.request.headers.has("X-Nox-Ingest-Key") && context.data?.auth?.type !== "api_token") {
    return ingestTelemetryEvent(context as Parameters<typeof ingestTelemetryEvent>[0]);
  }
  const payload = await context.request.clone().json().catch(() => null) as { type?: unknown; name?: unknown } | null;
  if (!payload || payload.type !== "activity.tracked" || typeof payload.name !== "string" || !GROWTH_EVENT.test(payload.name)) {
    return Response.json({ error: "growth_event_required" }, { status: 422 });
  }
  const headers = new Headers(context.request.headers);
  headers.set("X-Nox-Capability", "growth");
  return ingestTelemetryEvent({ ...context, request: new Request(context.request, { headers }) } as Parameters<typeof ingestTelemetryEvent>[0]);
}
