interface Env {
  DB: D1Database;
  BUILD_SHA?: string;
  NOXTICKET_SERVICE?: Fetcher;
  NOXSPOT_RESPONSE?: Fetcher;
  NOXCUE_RESPONSE?: NoxCueService;
  NOXFEED_RESPONSE?: Fetcher;
}

interface NoxCueService extends Fetcher {
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
interface HeartbeatRow { status: string; last_succeeded_at: string | null }
interface CountRow { count: number }

const HEARTBEAT_MAX_AGE_MS = 75 * 60 * 1000;
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

async function probeNoxCue(service: NoxCueService | undefined, expectedBuildSha: string): Promise<ServiceProbe> {
  const health = await probeService(service, "https://noxcue.internal/health");
  if (!health.ok || !health.buildSha || health.buildSha !== expectedBuildSha || !service) return { ...health, ok: false };
  try {
    const occurredAt = "2026-01-01T00:00:00.000Z";
    const result = await service.buildGitHubIncident({
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
    });
    const presentation = result as { contract?: unknown; kind?: unknown; marker?: unknown; body?: unknown } | null;
    const capable = presentation?.contract === "noxcue.response"
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
  const checks: Record<string, boolean> = {
    database: false,
    scheduledWorker: false,
    deliveryQueue: false,
    noxticket: false,
    noxspot: false,
    noxcue: false,
    noxfeed: false,
  };

  try {
    const heartbeat = await context.env.DB.prepare(
      "SELECT status, last_succeeded_at FROM service_heartbeats WHERE component = 'scheduled.cron'",
    ).first<HeartbeatRow>();
    const staleOutbox = await context.env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM delivery_outbox
      WHERE status IN ('pending', 'queued', 'processing', 'retrying')
        AND created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-70 minutes')
    `).first<CountRow>();
    checks.database = true;
    const lastSuccessMs = heartbeat?.last_succeeded_at ? Date.parse(heartbeat.last_succeeded_at) : Number.NaN;
    checks.scheduledWorker = heartbeat?.status === "healthy"
      && Number.isFinite(lastSuccessMs)
      && Date.now() - lastSuccessMs <= HEARTBEAT_MAX_AGE_MS;
    checks.deliveryQueue = Number(staleOutbox?.count ?? 0) === 0;
  } catch {
    // Public health responses expose component state, never internal errors.
  }

  const [ticket, spot, cue, feed] = await Promise.all([
    probeService(context.env.NOXTICKET_SERVICE, "https://noxticket.internal/health"),
    probeService(context.env.NOXSPOT_RESPONSE, "https://noxspot.internal/health"),
    probeNoxCue(context.env.NOXCUE_RESPONSE, expectedBuildSha),
    probeService(context.env.NOXFEED_RESPONSE, "https://noxfeed.internal/health"),
  ]);
  checks.noxticket = ticket.ok;
  checks.noxspot = spot.ok;
  checks.noxcue = cue.ok;
  checks.noxfeed = feed.ok;
  const versions = {
    noxhere: expectedBuildSha,
    ...(ticket.buildSha ? { noxticket: ticket.buildSha } : {}),
    ...(spot.buildSha ? { noxspot: spot.buildSha } : {}),
    ...(cue.buildSha ? { noxcue: cue.buildSha } : {}),
    ...(feed.buildSha ? { noxfeed: feed.buildSha } : {}),
  };

  const ready = Object.values(checks).every(Boolean);
  return Response.json(
    { service: "noxhere", status: ready ? "ok" : "not_ready", checks, versions },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
