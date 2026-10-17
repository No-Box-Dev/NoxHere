import { onRequest as ingestTelemetryEvent } from "../../telemetry/public/v1/events";

interface IngestContext {
  env: { TELEMETRY_RESPONSE?: Fetcher };
  request: Request;
  data?: Record<string, unknown>;
}

export async function onRequest(context: IngestContext): Promise<Response> {
  if (context.request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const payload = await context.request.clone().json().catch(() => null) as { type?: unknown; name?: unknown } | null;
  const accepted = payload?.type === "user.registered"
    || payload?.type === "user.active"
    || payload?.type === "activity.occurred"
    || (payload?.type === "activity.tracked" && typeof payload.name === "string" && payload.name.startsWith("custom."));
  if (!accepted) return Response.json({ error: "usage_event_required" }, { status: 422 });
  const headers = new Headers(context.request.headers);
  headers.set("X-Nox-Capability", "usage");
  return ingestTelemetryEvent({ ...context, request: new Request(context.request, { headers }) } as Parameters<typeof ingestTelemetryEvent>[0]);
}
