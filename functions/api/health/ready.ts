interface Env {
  DB: D1Database;
  BUILD_SHA?: string;
  PLANNING_SERVICE?: Fetcher;
  FEEDBACK_RESPONSE?: Fetcher;
  TELEMETRY_RESPONSE?: TelemetryService;
  ACTIVITY_RESPONSE?: Fetcher;
}

interface TelemetryService extends Fetcher {
  buildGitHubIncident(input: {
    environment: string;
    incidentKey: string;
    title: string;
    payloadJson: string;
    sourceName: string;
    firstSeenAt: string;
    lastSeenAt: string;
    occurrenceCount: number;
  }, previous?: { url: string } | null): Promise<unknown>;
}

interface Context { env: Env }
interface HeartbeatRow { status: string; last_succeeded_at: string | null; release: string | null }
interface CountRow { count: number }

const BACKGROUND_HEARTBEAT_MAX_AGE_MS = 10 * 60 * 1000;
const REQUIRED_CHECKS = ["database", "deliveryQueue", "planning", "feedback", "telemetry", "activity"] as const;
const SERVICE_TIMEOUT_MS = 2_000;
interface ServiceProbe { ok: boolean; buildSha?: string }

async function probeService(service: Fetcher | undefined, url: string): Promise<ServiceProbe> {
  if (!service) return { ok: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
  try {
    const response = await service.fetch(new Request(url, { signal: controller.signal }));
    const body: { buildSha?: unknown } = await response.json<{ buildSha?: unknown }>().catch(() => ({}));
    return { ok: response.ok, ...(typeof body.buildSha === "string" ? { buildSha: body.buildSha } : {}) };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function withServiceTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("service_timeout")), SERVICE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function probeTelemetry(service: TelemetryService | undefined, expectedBuildSha: string): Promise<ServiceProbe> {
  const health = await probeService(service, "https://telemetry.internal/health");
  if (!health.ok || !health.buildSha || health.buildSha !== expectedBuildSha || !service) return { ...health, ok: false };
  try {
    const occurredAt = "2026-01-01T00:00:00.000Z";
    const result = await withServiceTimeout(service.buildGitHubIncident({
      environment: "production",
      incidentKey: "readiness/synthetic",
      title: "Synthetic readiness probe",
      payloadJson: JSON.stringify({
        impact: "Synthetic readiness probe.",
        diagnosis: { possibleCauses: [], possibleFixes: [] },
      }),
      sourceName: "NoxHere readiness",
      firstSeenAt: occurredAt,
      lastSeenAt: occurredAt,
      occurrenceCount: 1,
    }));
    const presentation = result as { contract?: unknown; kind?: unknown; marker?: unknown; body?: unknown } | null;
    const capable = presentation?.contract === "telemetry.response"
      && presentation.kind === "github_incident"
      && typeof presentation.marker === "string"
      && typeof presentation.body === "string";
    return { ...health, ok: capable };
  } catch {
    return { ...health, ok: false };
  }
}

export async function onRequestGet(context: Context): Promise<Response> {
  const expectedBuildSha = context.env.BUILD_SHA ?? "development";
  let backgroundRelease: string | undefined;
  const checks: Record<string, boolean> = {
    database: false,
    backgroundWorker: false,
    deliveryQueue: false,
    planning: false,
    feedback: false,
    telemetry: false,
    activity: false,
  };

  try {
    const heartbeat = await context.env.DB.prepare(
      "SELECT status, last_succeeded_at, release FROM service_heartbeats WHERE component = 'background.schedule'",
    ).first<HeartbeatRow>();
    const staleOutbox = await context.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM delivery_outbox
      WHERE status IN ('pending', 'queued', 'processing', 'retrying')
        AND created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-70 minutes')
    `).first<CountRow>();
    checks.database = true;
    backgroundRelease = typeof heartbeat?.release === "string" ? heartbeat.release : undefined;
    const lastSuccessMs = heartbeat?.last_succeeded_at ? Date.parse(heartbeat.last_succeeded_at) : Number.NaN;
    checks.backgroundWorker = heartbeat?.status === "healthy"
      && Number.isFinite(lastSuccessMs)
      && Date.now() - lastSuccessMs <= BACKGROUND_HEARTBEAT_MAX_AGE_MS
      && backgroundRelease === expectedBuildSha;
    checks.deliveryQueue = Number(staleOutbox?.count ?? 0) === 0;
  } catch {
    // Public health responses expose component state, never internal errors.
  }

  const [ticket, spot, cue, feed] = await Promise.all([
    probeService(context.env.PLANNING_SERVICE, "https://planning.internal/health"),
    probeService(context.env.FEEDBACK_RESPONSE, "https://feedback.internal/health"),
    probeTelemetry(context.env.TELEMETRY_RESPONSE, expectedBuildSha),
    probeService(context.env.ACTIVITY_RESPONSE, "https://activity.internal/health"),
  ]);
  checks.planning = ticket.ok;
  checks.feedback = spot.ok;
  checks.telemetry = cue.ok;
  checks.activity = feed.ok;
  const versions = {
    noxhere: expectedBuildSha,
    ...(backgroundRelease ? { background: backgroundRelease } : {}),
    ...(ticket.buildSha ? { planning: ticket.buildSha } : {}),
    ...(spot.buildSha ? { feedback: spot.buildSha } : {}),
    ...(cue.buildSha ? { telemetry: cue.buildSha } : {}),
    ...(feed.buildSha ? { activity: feed.buildSha } : {}),
  };

  const ready = REQUIRED_CHECKS.every((check) => checks[check]);
  const status = ready
    ? (checks.backgroundWorker ? "ok" : "degraded")
    : "not_ready";
  return Response.json(
    { service: "noxhere", status, checks, versions },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
