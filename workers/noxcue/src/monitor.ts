import type { CueEnvironment } from "./environment";
import { readableKeySegment, stageGithubIncident } from "./github-incidents";
import { publishSlackTransport } from "../../../functions/lib/transport-outbox";

interface MonitorRow {
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  project_id: string | null;
  environment: CueEnvironment;
  url: string;
  status: "waiting" | "healthy" | "issue";
  consecutive_failures: number;
  consecutive_successes: number;
  incident_started_at: string | null;
  last_checked_at: string | null;
  last_status_code: number | null;
  last_latency_ms: number | null;
  last_error: string | null;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
}

export interface EndpointProbeResult {
  healthy: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

export interface EndpointTestResult extends EndpointProbeResult {
  queued: boolean;
  channelConfigured: boolean;
  deliveryId: string | null;
  checkedAt: string;
}

export interface EndpointStateInput {
  status: "waiting" | "healthy" | "issue";
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  incidentStartedAt: string | null;
}

export function nextEndpointState(state: EndpointStateInput, healthy: boolean, now: string) {
  const consecutiveFailures = healthy ? 0 : state.consecutiveFailures + 1;
  const consecutiveSuccesses = healthy ? state.consecutiveSuccesses + 1 : 0;
  const status = healthy
    ? state.status === "issue" && consecutiveSuccesses < 2 ? "issue" : "healthy"
    : consecutiveFailures >= 2 ? "issue" : state.status;
  return {
    status,
    consecutiveFailures,
    consecutiveSuccesses,
    incidentStartedAt: status === "issue" ? state.incidentStartedAt ?? now : null,
  };
}

const MAX_REDIRECTS = 3;
const CHECK_TIMEOUT_MS = 10_000;

export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local")
      && !host.endsWith(".internal") && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !host.includes(":");
  } catch { return false; }
}

function errorName(cause: unknown): string {
  if (cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError")) return "Timed out after 10 seconds";
  return "Network request failed";
}

export async function probeEndpoint(
  initialUrl: string,
  fetcher: typeof fetch = fetch,
  now: () => number = () => performance.now(),
): Promise<EndpointProbeResult> {
  const startedAt = now();
  if (!isSafePublicUrl(initialUrl)) {
    return { healthy: false, statusCode: null, latencyMs: 0, error: "URL is not a public HTTPS endpoint" };
  }

  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  let currentUrl = initialUrl;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await fetcher(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
      });
      const location = response.headers.get("Location");
      const statusCode = response.status;
      await response.body?.cancel();

      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        if (!location) return { healthy: false, statusCode, latencyMs: Math.round(now() - startedAt), error: `HTTP ${statusCode} without a redirect location` };
        if (redirects === MAX_REDIRECTS) return { healthy: false, statusCode, latencyMs: Math.round(now() - startedAt), error: "Too many redirects" };
        const nextUrl = new URL(location, currentUrl).toString();
        if (!isSafePublicUrl(nextUrl)) return { healthy: false, statusCode, latencyMs: Math.round(now() - startedAt), error: "Redirected to an unsafe URL" };
        currentUrl = nextUrl;
        continue;
      }

      const latencyMs = Math.max(0, Math.round(now() - startedAt));
      const healthy = statusCode >= 200 && statusCode < 300;
      return { healthy, statusCode, latencyMs, error: healthy ? null : `HTTP ${statusCode}` };
    }
  } catch (cause) {
    return { healthy: false, statusCode: null, latencyMs: Math.max(0, Math.round(now() - startedAt)), error: errorName(cause) };
  }
  return { healthy: false, statusCode: null, latencyMs: Math.max(0, Math.round(now() - startedAt)), error: "Endpoint check failed" };
}

function slackEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function durationBetween(from: string | null, to: string): string | null {
  if (!from) return null;
  const seconds = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1_000));
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3_600)}h`;
}

function transitionMessage(row: MonitorRow, transition: "issue" | "recovery", result: EndpointProbeResult, at: string) {
  const recovered = transition === "recovery";
  const headline = recovered ? "Endpoint recovered" : "Endpoint unavailable";
  const resultLine = recovered
    ? `Two consecutive checks passed${result.statusCode ? ` · HTTP ${result.statusCode}` : ""} · ${result.latencyMs} ms`
    : `Two consecutive checks failed · ${slackEscape(result.error ?? "Unknown error")}`;
  const downtime = recovered ? durationBetween(row.incident_started_at, at) : null;
  return { text: `${row.source_name}: ${headline}`, blocks: [
    { type: "header", text: { type: "plain_text", text: `${recovered ? "✅" : "🚨"} ${headline}`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${slackEscape(row.source_name)}*\n${resultLine}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: [
      slackEscape(row.url), row.environment, downtime ? `Unavailable for about ${downtime}` : null, "NoxCue endpoint health",
    ].filter(Boolean).join(" · ") }] },
  ] };
}

function testMessage(row: MonitorRow, result: EndpointProbeResult) {
  const headline = result.healthy ? "Endpoint test passed" : "Endpoint test failed";
  const detail = result.healthy
    ? `NoxCue received HTTP ${result.statusCode} in ${result.latencyMs} ms.`
    : `NoxCue could not confirm a healthy response · ${slackEscape(result.error ?? "Unknown error")}.`;
  return { text: `${row.source_name}: ${headline}`, blocks: [
    { type: "header", text: { type: "plain_text", text: `${result.healthy ? "✅" : "⚠️"} ${headline}`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${slackEscape(row.source_name)}*\n${detail}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${slackEscape(row.url)} · ${row.environment} · Manual setup test · NoxCue` }] },
  ] };
}

async function notify(env: Env, row: MonitorRow, kind: "issue" | "recovery" | "test", at: string, result: EndpointProbeResult): Promise<string | null> {
  if (!row.slack_channel_id || !row.project_id) return null;
  const sourceId = kind === "test" ? `endpoint:${row.source_id}:test:${crypto.randomUUID()}` : `endpoint:${row.source_id}:${kind}:${at}`;
  const payload = kind === "test" ? testMessage(row, result) : transitionMessage(row, kind, result, at);
  try {
    const publication = await publishSlackTransport({ DB: env.NOX_DB, TASK_QUEUE: env.NOX_TASKS }, {
      orgId: row.org_id,
      projectId: row.project_id,
      route: "incidents",
      routeContext: { kind: "source", id: row.source_id },
      idempotencyKey: `noxcue:${sourceId}`,
      message: payload,
    });
    return publication.outboxId;
  } catch (cause) {
    console.error(JSON.stringify({ message: "endpoint alert queue failed", sourceId, error: cause instanceof Error ? cause.message : String(cause) }));
    return null;
  }
}

async function checkEndpointMonitor(env: Env, row: MonitorRow): Promise<void> {
  const now = new Date().toISOString();
  const result = await probeEndpoint(row.url);
  const next = nextEndpointState({
    status: row.status,
    consecutiveFailures: row.consecutive_failures,
    consecutiveSuccesses: row.consecutive_successes,
    incidentStartedAt: row.incident_started_at,
  }, result.healthy, now);
  await env.NOX_DB.prepare(
    `UPDATE cue_endpoint_monitors SET status = ?, consecutive_failures = ?, consecutive_successes = ?,
       incident_started_at = ?, last_checked_at = ?, last_status_code = ?, last_latency_ms = ?,
       last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
       last_failure_at = CASE WHEN ? THEN last_failure_at ELSE ? END, last_error = ?,
       last_transition_at = CASE WHEN status IS NOT ? THEN ? ELSE last_transition_at END, updated_at = ?
     WHERE source_id = ?`,
  ).bind(next.status, next.consecutiveFailures, next.consecutiveSuccesses, next.incidentStartedAt,
    now, result.statusCode, result.latencyMs, result.healthy ? 1 : 0, now, result.healthy ? 1 : 0,
    now, result.error, next.status, now, now, row.source_id).run();
  if (row.status !== "issue" && next.status === "issue") {
    const host = new URL(row.url).hostname;
    const code = result.statusCode ? `http_${result.statusCode}` : readableKeySegment(result.error, "network_error");
    await Promise.all([
      notify(env, row, "issue", next.incidentStartedAt!, result),
      stageGithubIncident(env, row, {
        key: `endpoint.health/unavailable/${readableKeySegment(host, "endpoint")}/${readableKeySegment(code, "unknown_code")}/health_check`,
        kind: "endpoint",
        title: "Endpoint unavailable",
        occurredAt: next.incidentStartedAt!,
        payload: {
          impact: `Two consecutive health checks failed for ${row.url}.`,
          message: result.error ?? "Endpoint check failed",
          error: {
            name: "EndpointHealthError",
            message: result.error ?? "Endpoint check failed",
            ...(result.statusCode ? { code: `HTTP_${result.statusCode}`, status: result.statusCode } : { code: "NETWORK_ERROR" }),
          },
          context: { runtime: "edge", url: row.url },
          diagnosis: {
            summary: result.statusCode
              ? `Endpoint returned HTTP ${result.statusCode} twice.`
              : "NoxCue could not reach the endpoint twice.",
            possibleCauses: result.statusCode && result.statusCode >= 500
              ? ["The application or a required dependency is unavailable.", "The deployed health route is failing."]
              : ["DNS, TLS, routing or application availability interrupted the checks."],
            possibleFixes: ["Inspect application and edge logs at the recorded time.", "Check the current deployment and dependency status.", "Verify the configured health URL still returns a 2xx response."],
          },
        },
      }),
    ]);
  }
  if (row.status === "issue" && next.status === "healthy") await notify(env, row, "recovery", now, result);
}

const ROUTED_MONITOR_SELECT = `
  SELECT monitor.org_id, source.owner_id, source.id AS source_id, source.name AS source_name,
         source.project_id, source.environment,
         monitor.url, monitor.status, monitor.consecutive_failures,
         COALESCE(monitor.consecutive_successes, 0) AS consecutive_successes, monitor.incident_started_at,
         monitor.last_checked_at, monitor.last_status_code, monitor.last_latency_ms, monitor.last_error,
         CASE WHEN source.alerts_enabled = 1 THEN COALESCE(NULLIF(alert_route.channel_id, ''), NULLIF(legacy_route.channel_id, ''),
           NULLIF(source.slack_channel_id, ''), NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), ''),
           NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')) END AS slack_channel_id,
         CASE WHEN source.alerts_enabled = 1 THEN CASE WHEN NULLIF(alert_route.channel_id, '') IS NOT NULL THEN NULLIF(alert_route.connection_id, '')
           WHEN NULLIF(legacy_route.channel_id, '') IS NOT NULL THEN NULLIF(legacy_route.connection_id, '')
           WHEN NULLIF(source.slack_channel_id, '') IS NOT NULL THEN NULLIF(source.slack_connection_id, '')
           WHEN NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), '') IS NOT NULL
             THEN NULLIF(json_extract(config.data, '$.slack.noxCueConnectionId'), '')
           ELSE NULLIF(json_extract(config.data, '$.slack.fallbackConnectionId'), '') END END AS slack_connection_id
    FROM cue_endpoint_monitors monitor JOIN cue_sources source ON source.id = monitor.source_id
    LEFT JOIN config ON config.org_id = source.org_id AND config.key = 'settings'
    LEFT JOIN project_routing_settings routing ON routing.org_id = source.org_id
      AND routing.project_id = source.project_id AND routing.enabled = 1
    LEFT JOIN project_slack_routes alert_route ON alert_route.org_id = source.org_id
      AND alert_route.project_id = source.project_id AND alert_route.route_key = 'noxcue_alerts' AND routing.enabled = 1
    LEFT JOIN project_slack_routes legacy_route ON legacy_route.org_id = source.org_id
      AND legacy_route.project_id = source.project_id AND legacy_route.route_key = 'noxcue' AND routing.enabled = 1`;

export async function testEndpointMonitor(env: Env, orgId: number, sourceId: string): Promise<EndpointTestResult> {
  const row = await env.NOX_DB.prepare(
    `${ROUTED_MONITOR_SELECT}
      WHERE monitor.org_id = ? AND monitor.source_id = ? AND monitor.enabled = 1
        AND monitor.url IS NOT NULL AND source.enabled = 1
        AND COALESCE(json_extract(config.data, '$.apps.noxcue'), 1) != 0`,
  ).bind(orgId, sourceId).first<MonitorRow>();
  if (!row) throw new Error("Enabled endpoint monitor not found");
  if (!row.last_checked_at || Date.now() - Date.parse(row.last_checked_at) > 3 * 60_000) {
    throw new Error("No recent scheduled endpoint check");
  }
  const healthy = row.last_error === null && row.last_status_code !== null
    && row.last_status_code >= 200 && row.last_status_code < 300;
  const result: EndpointProbeResult = {
    healthy,
    statusCode: row.last_status_code,
    latencyMs: row.last_latency_ms ?? 0,
    error: healthy ? null : row.last_error ?? "The latest scheduled check failed",
  };
  const deliveryId = await notify(env, row, "test", new Date().toISOString(), result);
  return {
    ...result,
    queued: Boolean(deliveryId),
    channelConfigured: Boolean(row.slack_channel_id),
    deliveryId,
    checkedAt: row.last_checked_at,
  };
}

export async function runEndpointMonitors(env: Env): Promise<void> {
  const result = await env.NOX_DB.prepare(
    `${ROUTED_MONITOR_SELECT}
      WHERE monitor.enabled = 1 AND monitor.url IS NOT NULL AND source.enabled = 1
        AND COALESCE(json_extract(config.data, '$.apps.noxcue'), 1) != 0
        AND (monitor.last_checked_at IS NULL OR datetime(monitor.last_checked_at) <= datetime('now', '-50 seconds'))
      ORDER BY monitor.last_checked_at LIMIT 25`,
  ).all<MonitorRow>();
  const rows = result.results ?? [];
  for (let index = 0; index < rows.length; index += 5) {
    await Promise.all(rows.slice(index, index + 5).map((row) => checkEndpointMonitor(env, row)));
  }
  await env.NOX_DB.prepare("DELETE FROM cue_feature_results WHERE received_at < datetime('now', '-7 days')").run();
}
