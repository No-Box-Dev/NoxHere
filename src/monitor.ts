interface MonitorRow {
  org_id: number; owner_id: string; source_id: string; source_name: string; url: string;
  status: "waiting" | "healthy" | "issue"; consecutive_failures: number;
  incident_started_at: string | null; slack_channel_id: string | null; slack_connection_id: string | null;
}

interface SlackTask { type: "deliver_slack"; outboxId: string; ownerId: string; deliveryId: string; }

function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local")
      && !host.endsWith(".internal") && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !host.includes(":");
  } catch { return false; }
}

function message(row: MonitorRow, recovered: boolean, error: string | null) {
  const headline = recovered ? "App endpoint recovered" : "App endpoint is unavailable";
  return { text: `${row.source_name}: ${headline}`, blocks: [
    { type: "section", text: { type: "mrkdwn", text: `${recovered ? ":white_check_mark:" : ":rotating_light:"} *${headline}*\n${recovered ? "A successful external check was received." : `Two consecutive external checks failed${error ? ` · ${error}` : ""}.`}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `NoxCue · ${row.source_name} · endpoint health` }] },
  ] };
}

async function notify(env: Env, row: MonitorRow, transition: "issue" | "recovery", at: string, error: string | null) {
  if (!row.slack_channel_id) return;
  const sourceId = `endpoint:${row.source_id}:${transition}:${at}`;
  const deliveryId = crypto.randomUUID();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO delivery_outbox
       (id, org_id, source, source_id, destination, site_id, slack_connection_id, channel_id, payload_json, status)
     VALUES (?, ?, 'noxcue', ?, 'slack', NULL, ?, ?, ?, 'pending')`,
  ).bind(deliveryId, row.org_id, sourceId, row.slack_connection_id, row.slack_channel_id,
    JSON.stringify({ message: message(row, transition === "recovery", error) })).run();
  if (!inserted.meta.changes) return;
  try {
    const task: SlackTask = { type: "deliver_slack", outboxId: deliveryId, ownerId: row.owner_id, deliveryId };
    await env.NOX_TASKS.send(task);
    await env.NOX_DB.prepare("UPDATE delivery_outbox SET status = 'queued', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), deliveryId).run();
  } catch (cause) {
    console.error(JSON.stringify({ message: "endpoint alert queue failed", sourceId,
      error: cause instanceof Error ? cause.message : String(cause) }));
  }
}

async function check(env: Env, row: MonitorRow): Promise<void> {
  const now = new Date().toISOString();
  let healthy = false;
  let error: string | null = null;
  if (!isSafePublicUrl(row.url)) {
    error = "unsafe_url";
  } else {
    try {
      const response = await fetch(row.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "NoxCue-Health/1.0", Accept: "text/plain, application/json;q=0.9, */*;q=0.1" } });
      healthy = response.status >= 200 && response.status < 400;
      if (!healthy) error = `HTTP ${response.status}`;
      await response.body?.cancel();
    } catch (cause) {
      error = cause instanceof DOMException && cause.name === "TimeoutError" ? "timeout" : "network_error";
    }
  }
  const oldStatus = row.status;
  const failures = healthy ? 0 : row.consecutive_failures + 1;
  const status = healthy ? "healthy" : failures >= 2 ? "issue" : oldStatus;
  const incidentAt = status === "issue" ? row.incident_started_at ?? now : null;
  await env.NOX_DB.prepare(
    `UPDATE cue_endpoint_monitors SET status = ?, consecutive_failures = ?, incident_started_at = ?,
       last_checked_at = ?, last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
       last_failure_at = CASE WHEN ? THEN last_failure_at ELSE ? END, last_error = ?, updated_at = ?
     WHERE source_id = ?`,
  ).bind(status, failures, incidentAt, now, healthy ? 1 : 0, now, healthy ? 1 : 0, now,
    healthy ? null : error, now, row.source_id).run();
  if (oldStatus !== "issue" && status === "issue") await notify(env, row, "issue", incidentAt!, error);
  if (oldStatus === "issue" && status === "healthy") await notify(env, row, "recovery", now, null);
}

export async function runEndpointMonitors(env: Env): Promise<void> {
  const result = await env.NOX_DB.prepare(
    `SELECT monitor.org_id, source.owner_id, source.id AS source_id, source.name AS source_name,
            monitor.url, monitor.status, monitor.consecutive_failures, monitor.incident_started_at,
            COALESCE(NULLIF(source.slack_channel_id, ''), NULLIF(route.channel_id, ''),
              NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), ''),
              NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')) AS slack_channel_id,
            CASE WHEN NULLIF(source.slack_channel_id, '') IS NOT NULL THEN NULLIF(source.slack_connection_id, '')
              WHEN NULLIF(route.channel_id, '') IS NOT NULL THEN NULLIF(route.connection_id, '')
              WHEN NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), '') IS NOT NULL
                THEN NULLIF(json_extract(config.data, '$.slack.noxCueConnectionId'), '')
              ELSE NULLIF(json_extract(config.data, '$.slack.fallbackConnectionId'), '') END AS slack_connection_id
       FROM cue_endpoint_monitors monitor JOIN cue_sources source ON source.id = monitor.source_id
       LEFT JOIN config ON config.org_id = source.org_id AND config.key = 'settings'
       LEFT JOIN project_slack_routes route ON route.org_id = source.org_id AND route.project_id = source.project_id
         AND route.route_key = 'noxcue'
         AND EXISTS (SELECT 1 FROM project_routing_settings setting
           WHERE setting.org_id = source.org_id AND setting.project_id = source.project_id AND setting.enabled = 1)
       WHERE monitor.enabled = 1 AND monitor.url IS NOT NULL AND source.enabled = 1
         AND (monitor.last_checked_at IS NULL OR datetime(monitor.last_checked_at) <= datetime('now', '-4 minutes'))
       ORDER BY monitor.last_checked_at LIMIT 25`,
  ).all<MonitorRow>();
  for (const row of result.results ?? []) await check(env, row);
  await env.NOX_DB.prepare("DELETE FROM cue_feature_results WHERE received_at < datetime('now', '-7 days')").run();
}
