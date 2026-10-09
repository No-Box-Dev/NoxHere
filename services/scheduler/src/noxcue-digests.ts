import { publishSlackTransport } from "../../../functions/lib/transport-outbox";
import { getNoxCueDigestResponse } from "../../../functions/lib/noxcue-response.js";
import { loadNoxCueDigestData, storeNoxCueDerivedMetrics } from "../../../functions/lib/noxcue-digest-data.js";
import { loadEnabledNoxCueMetricKeys, loadNoxCueSourceCards, selectNoxCueDigestMetrics } from "../../../functions/lib/noxcue-project-metrics.js";

const MAX_SOURCES_PER_TICK = 100;
const MAX_CATCH_UP_DAYS = 7;

interface DigestResponseService {
  buildDigestResponse(
    sourceName: string,
    period: string,
    metrics: Record<string, number>,
    comparisons: Record<string, {
      yesterday: number | null;
      average30d: number | null;
      sampleDays: number;
      history: Array<{ period: string; value: number }>;
    }>,
    metricLabels?: Record<string, string>,
  ): Promise<unknown>;
}

interface DigestEnv {
  DB: D1Database;
  TASK_QUEUE: Queue;
  NOXCUE_RESPONSE: DigestResponseService;
}

interface DigestSource {
  id: string;
  org_id: number;
  owner_id: string;
  project_id: string;
  name: string;
  environment: string;
  timezone: string;
  digest_time_local: string;
  report_title: string | null;
  source_channel_id: string | null;
  source_connection_id: string | null;
  project_channel_id: string | null;
  project_connection_id: string | null;
  organization_channel_id: string | null;
  organization_connection_id: string | null;
  fallback_channel_id: string | null;
  fallback_connection_id: string | null;
  latest_digest_period: string | null;
}

type SlackDestination = { channelId: string; connectionId: string };

export function sourceReportTitle(source: Pick<DigestSource, "name" | "environment" | "report_title">) {
  const environment = source.environment.charAt(0).toUpperCase() + source.environment.slice(1);
  const fallback = source.name.toLowerCase().includes(source.environment.toLowerCase())
    ? source.name
    : `${source.name} · ${environment}`;
  return source.report_title?.trim() || fallback;
}

export function resolveDigestSlackDestination(source: DigestSource): SlackDestination | null {
  const candidates = [
    [source.source_channel_id, source.source_connection_id],
    [source.project_channel_id, source.project_connection_id],
    [source.organization_channel_id, source.organization_connection_id],
    [source.fallback_channel_id, source.fallback_connection_id],
  ];
  const pair = candidates.find(([channelId, connectionId]) => channelId && connectionId);
  return pair ? { channelId: pair[0]!, connectionId: pair[1]! } : null;
}

export function localDateTime(nowMs: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    period: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function previousPeriod(period: string) {
  const value = new Date(`${period}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function nextPeriod(period: string) {
  const value = new Date(`${period}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function digestPeriodsToAttempt(completedPeriod: string, latestDigestPeriod: string | null) {
  if (!latestDigestPeriod || latestDigestPeriod >= completedPeriod) return [completedPeriod];
  const boundedStartDate = new Date(`${completedPeriod}T00:00:00Z`);
  boundedStartDate.setUTCDate(boundedStartDate.getUTCDate() - (MAX_CATCH_UP_DAYS - 1));
  const boundedStart = boundedStartDate.toISOString().slice(0, 10);
  let cursor = nextPeriod(latestDigestPeriod);
  if (cursor < boundedStart) cursor = boundedStart;
  const periods: string[] = [];
  while (cursor <= completedPeriod && periods.length < MAX_CATCH_UP_DAYS) {
    periods.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return periods;
}

function configuredMinutes(value: string) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

async function createDigest(
  env: DigestEnv,
  source: DigestSource,
  destination: SlackDestination,
  period: string,
) {
  const existing = await env.DB.prepare(
    "SELECT id FROM cue_digest_runs WHERE source_id = ? AND period = ?",
  ).bind(source.id, period).first();
  if (existing) return { skipped: "already_created" };

  const digest = await loadNoxCueDigestData(env.DB, source.id, period);
  const { metrics, hasData, derivedFromEvents } = digest;
  if (!hasData) return { skipped: "no_data" };
  if (derivedFromEvents) {
    await storeNoxCueDerivedMetrics(env.DB, source.org_id, source.id, period, metrics);
  }

  const enabledKeys = await loadEnabledNoxCueMetricKeys(env.DB, source.org_id, source.project_id, source.id);
  const selected = selectNoxCueDigestMetrics(digest, enabledKeys);
  const cards = await loadNoxCueSourceCards(env.DB, source.org_id, source.id) as Array<{
    metric_key: string;
    daily_label: string | null;
    cumulative_label: string | null;
  }>;
  if (cards.length > 0) {
    selected.metricLabels = Object.fromEntries(cards.map((card) => [
      String(card.metric_key), String(card.daily_label || card.cumulative_label || selected.metricLabels[String(card.metric_key)] || ""),
    ]));
  }

  const displayName = sourceReportTitle(source);
  const response = await getNoxCueDigestResponse(
    env,
    displayName,
    period,
    selected.metrics,
    selected.comparisons,
    selected.metricLabels,
    selected.activityBreakdowns,
    source.project_id ? { organizationId: source.org_id, projectId: source.project_id, sourceId: source.id } : undefined,
  );
  const delivery = await publishSlackTransport(env, {
    orgId: source.org_id,
    projectId: source.project_id,
    route: "engagement",
    routeContext: { kind: "source", id: source.id },
    idempotencyKey: `noxcue:digest:${source.id}:${period}`,
    message: response.message,
  });
  const digestId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO cue_digest_runs
       (id, org_id, source_id, period, transport_outbox_id, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    digestId,
    source.org_id,
    source.id,
    period,
    delivery.outboxId,
    JSON.stringify({ metrics: selected.metrics, comparisons: selected.comparisons }),
  ).run();
  return { created: true, queued: delivery.queued };
}

export async function runNoxCueDigests(env: DigestEnv, nowMs = Date.now()) {
  const { results } = await env.DB.prepare(
    `SELECT source.id, source.org_id, source.owner_id, source.project_id, source.name, source.environment, source.timezone,
            source.digest_time_local, source.report_title,
            NULLIF(source.slack_channel_id, '') AS source_channel_id,
            NULLIF(source.slack_connection_id, '') AS source_connection_id,
            NULLIF(project_route.channel_id, '') AS project_channel_id,
            NULLIF(project_route.connection_id, '') AS project_connection_id,
            NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), '') AS organization_channel_id,
            NULLIF(json_extract(config.data, '$.slack.noxCueConnectionId'), '') AS organization_connection_id,
            NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '') AS fallback_channel_id,
            NULLIF(json_extract(config.data, '$.slack.fallbackConnectionId'), '') AS fallback_connection_id,
            (SELECT MAX(digest.period) FROM cue_digest_runs digest
              WHERE digest.source_id = source.id) AS latest_digest_period
       FROM cue_sources source
       JOIN project_config config
         ON config.org_id = source.org_id AND config.project_id = source.project_id AND config.key = 'settings'
       LEFT JOIN project_slack_routes project_route
         ON project_route.org_id = source.org_id
        AND project_route.project_id = source.project_id
        AND project_route.route_key = 'noxcue'
        AND EXISTS (
          SELECT 1 FROM project_routing_settings routing_settings
           WHERE routing_settings.org_id = source.org_id
             AND routing_settings.project_id = source.project_id
             AND routing_settings.enabled = 1
        )
      WHERE source.enabled = 1 AND source.digest_enabled = 1 AND source.project_id IS NOT NULL
        AND COALESCE(json_extract(config.data, '$.apps.noxcue'), 1) != 0
      ORDER BY source.id LIMIT ?`,
  ).bind(MAX_SOURCES_PER_TICK).all<DigestSource>();
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const source of results ?? []) {
    const destination = resolveDigestSlackDestination(source);
    if (!destination) { skipped += 1; continue; }
    try {
      const local = localDateTime(nowMs, source.timezone);
      if (local.minutes < configuredMinutes(source.digest_time_local)) { skipped += 1; continue; }
      const completedPeriod = previousPeriod(local.period);
      for (const period of digestPeriodsToAttempt(completedPeriod, source.latest_digest_period)) {
        const result = await createDigest(env, source, destination, period);
        if (result.created) created += 1;
        else skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        event: "noxcue_digest_failed",
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM cue_user_active_days
      WHERE period < date('now', '-' || COALESCE((SELECT retention_days FROM cue_sources WHERE id = cue_user_active_days.source_id), 62) || ' days')`),
    env.DB.prepare(`DELETE FROM cue_activity_events
      WHERE period < date('now', '-' || COALESCE((SELECT retention_days FROM cue_sources WHERE id = cue_activity_events.source_id), 62) || ' days')`),
    env.DB.prepare(`DELETE FROM cue_tracked_events
      WHERE period < date('now', '-' || COALESCE((SELECT retention_days FROM cue_sources WHERE id = cue_tracked_events.source_id), 62) || ' days')`),
  ]);
  await env.DB.prepare(
    "DELETE FROM cue_error_receipts WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
  ).run();
  return { created, skipped, failed };
}
