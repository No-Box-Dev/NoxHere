import { getInstallationIdForOrg, getInstallationToken } from "./github-app.js";
import {
  findIssueByBodyMarker,
  getRepositoryIssue,
} from "./github-issues.js";
import { isAppEnabled } from "./apps.js";
import { publishGitHubTransport } from "./transport-outbox";

export async function createOrUpdateTelemetryGitHubIssue(env, task) {
  if (!task?.incidentId) throw new Error("Invalid Telemetry GitHub issue task");
  const claimed = await env.DB.prepare(
    `UPDATE telemetry_github_incidents
        SET status = 'processing', processing_occurrence_count = occurrence_count,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ? AND status IN ('pending', 'failed')`,
  ).bind(task.incidentId).run();
  if (!claimed.meta.changes) return { skipped: "already_processing_or_current" };

  try {
    return await processIncident(env, task.incidentId);
  } catch (error) {
    const permanentFailure = permanentIncidentFailure(error);
    if (permanentFailure) {
      await markDisabled(env.DB, task.incidentId, permanentFailure);
      return { skipped: "invalid_diagnostic_payload" };
    }
    await env.DB.prepare(
      `UPDATE telemetry_github_incidents SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`,
    ).bind(errorMessage(error), new Date().toISOString(), task.incidentId).run();
    throw error;
  }
}

async function processIncident(env, incidentId) {
  const row = await env.DB.prepare(
    `SELECT incident.*, setting.enabled, setting.environments_json, setting.comment_on_repeat,
            setting.repeat_interval_minutes, project.repo, org.github_login, source.name AS source_name
       FROM telemetry_github_incidents incident
       JOIN telemetry_github_issue_settings setting
         ON setting.org_id = incident.org_id AND setting.project_id = incident.project_id
       JOIN orgs org ON org.id = incident.org_id
       JOIN projects project ON project.id = incident.project_id AND project.owner_id = org.github_login
       JOIN telemetry_sources source ON source.id = incident.source_id AND source.org_id = incident.org_id
      WHERE incident.id = ?`,
  ).bind(incidentId).first();
  if (!row) {
    await markDisabled(env.DB, incidentId, "GitHub issue routing is not configured for this project");
    return { skipped: "not_configured" };
  }
  if (!row.enabled || !enabledEnvironment(row.environments_json, row.environment)) {
    await markDisabled(env.DB, incidentId, `GitHub issues are disabled for ${row.environment}`);
    return { skipped: "environment_disabled" };
  }
  if (!(await isAppEnabled(env.DB, row.org_id, "telemetry"))) {
    await markDisabled(env.DB, incidentId, "Telemetry is disabled");
    return { skipped: "service_disabled" };
  }
  if (!row.github_login || !validRepo(row.repo)) throw new Error("Linked project does not have a valid GitHub repository");
  const installationId = await getInstallationIdForOrg(env.DB, row.org_id);
  if (!installationId) throw new Error(`GitHub App not installed for org ${row.org_id}`);
  const token = await getInstallationToken(env, installationId);
  if (!env.TELEMETRY_RESPONSE?.buildGitHubIncident) throw new Error("Telemetry incident service binding is unavailable");
  const presentation = requirePresentation(await env.TELEMETRY_RESPONSE.buildGitHubIncident({
    environment: row.environment,
    incidentKey: row.incident_key,
    title: row.title,
    payloadJson: row.payload_json,
    sourceName: row.source_name,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
  }, row.previous_issue_url ? { url: row.previous_issue_url } : null));
  const marker = presentation.marker;

  let issue = null;
  if (row.github_issue_number && row.github_repo === row.repo) {
    try {
      issue = await getRepositoryIssue(token, row.github_login, row.repo, row.github_issue_number);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  if (!issue) issue = await findIssueByBodyMarker(token, row.github_login, row.repo, marker);

  const previous = issue?.state === "closed" ? issue : null;
  if (issue?.state === "open") {
    const shouldUpdate = updateDue(row.last_github_update_at, row.repeat_interval_minutes)
      || presentation.latestRelease !== (row.last_github_release ?? null);
    if (shouldUpdate) {
      const staged = await publishGitHubTransport(env, {
        orgId: row.org_id,
        projectId: row.project_id,
        route: "incidents",
        idempotencyKey: `telemetry:${incidentId}:${row.processing_occurrence_count}:update`,
        operation: "github.issue.update",
        input: { issueNumber: issue.number, issue: { body: presentation.body } },
        correlationId: incidentId,
        callback: { kind: "telemetry_incident", payload: callbackPayload(row, incidentId, issue, null, presentation.latestRelease, true) },
      });
      if (row.comment_on_repeat) {
        await publishGitHubTransport(env, {
          orgId: row.org_id,
          projectId: row.project_id,
          route: "incidents",
          idempotencyKey: `telemetry:${incidentId}:${row.processing_occurrence_count}:comment`,
          operation: "github.issue.comment",
          input: { issueNumber: issue.number, body: presentation.repeatComment },
          correlationId: incidentId,
        });
      }
      return { outboxId: staged.outboxId, status: staged.status, queued: staged.queued };
    }
    await completeIncident(env, callbackPayload(row, incidentId, issue, null, presentation.latestRelease, false), issue);
    return { number: issue.number, url: issue.html_url, deduplicated: true };
  } else {
    const createPresentation = previous
      ? requirePresentation(await env.TELEMETRY_RESPONSE.buildGitHubIncident({
          environment: row.environment, incidentKey: row.incident_key, title: row.title,
          payloadJson: row.payload_json, sourceName: row.source_name,
          firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
          occurrenceCount: row.occurrence_count,
        }, { url: previous.html_url }))
      : presentation;
    const staged = await publishGitHubTransport(env, {
      orgId: row.org_id,
      projectId: row.project_id,
      route: "incidents",
      idempotencyKey: `telemetry:${incidentId}:${row.processing_occurrence_count}:create`,
      operation: "github.issue.create",
      input: {
        issue: { title: createPresentation.title, body: createPresentation.body, labels: createPresentation.labels },
        idempotencyMarker: createPresentation.marker,
      },
      correlationId: incidentId,
      callback: { kind: "telemetry_incident", payload: callbackPayload(row, incidentId, null, previous, createPresentation.latestRelease, true) },
    });
    return { outboxId: staged.outboxId, status: staged.status, queued: staged.queued };
  }
}

function callbackPayload(row, incidentId, issue, previous, latestRelease, wroteIssue) {
  return {
    incidentId,
    repo: row.repo,
    issueNumber: issue?.number ?? null,
    issueUrl: issue?.html_url ?? null,
    issueCreatedAt: issue?.created_at ?? null,
    previousIssueNumber: previous?.number ?? row.previous_issue_number ?? null,
    previousIssueUrl: previous?.html_url ?? row.previous_issue_url ?? null,
    latestRelease,
    lastGitHubUpdateAt: row.last_github_update_at ?? null,
    lastGitHubRelease: row.last_github_release ?? null,
    wroteIssue,
  };
}

export async function finalizeTelemetryGitHubIssue(env, { receipt, payload }) {
  if (receipt.provider !== "github") throw new Error("Telemetry callback requires a GitHub receipt");
  if (receipt.status !== "delivered") {
    await env.DB.prepare(
      "UPDATE telemetry_github_incidents SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?",
    ).bind(receipt.error?.message ?? `GitHub transport ${receipt.status}`, new Date().toISOString(), payload.incidentId).run();
    return { skipped: receipt.status };
  }
  const issue = receipt.result?.resourceType === "issue"
    ? { number: Number(receipt.result.resourceId), html_url: receipt.result.url, created_at: payload.issueCreatedAt }
    : { number: Number(payload.issueNumber), html_url: payload.issueUrl, created_at: payload.issueCreatedAt };
  if (!Number.isInteger(issue.number) || issue.number <= 0 || !issue.html_url) throw new Error("Telemetry issue receipt is incomplete");
  await completeIncident(env, payload, issue);
  return { number: issue.number, url: issue.html_url };
}

async function completeIncident(env, payload, issue) {
  const now = new Date().toISOString();
  await env.DB.batch([
    ...(payload.previousIssueNumber ? [env.DB.prepare(
      `UPDATE telemetry_github_issue_links SET closed_at = COALESCE(closed_at, ?)
        WHERE incident_id = ? AND repo = ? AND issue_number = ?`,
    ).bind(now, payload.incidentId, payload.repo, payload.previousIssueNumber)] : []),
    env.DB.prepare(
      `INSERT INTO telemetry_github_issue_links
         (incident_id, repo, issue_number, issue_url, opened_at, closed_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(incident_id, repo, issue_number) DO UPDATE SET
         issue_url = excluded.issue_url, closed_at = NULL`,
    ).bind(payload.incidentId, payload.repo, issue.number, issue.html_url, issue.created_at ?? now),
    env.DB.prepare(
      `UPDATE telemetry_github_incidents SET
         status = CASE WHEN occurrence_count > processing_occurrence_count THEN 'pending' ELSE 'open' END,
         github_repo = ?, github_issue_number = ?, github_issue_url = ?, github_issue_state = 'open',
         previous_issue_number = ?, previous_issue_url = ?, last_github_update_at = ?,
         last_github_release = ?, last_error = NULL, updated_at = ? WHERE id = ?`,
    ).bind(
      payload.repo, issue.number, issue.html_url, payload.previousIssueNumber,
      payload.previousIssueUrl,
      payload.wroteIssue ? now : payload.lastGitHubUpdateAt,
      payload.wroteIssue ? payload.latestRelease : payload.lastGitHubRelease,
      now, payload.incidentId,
    ),
  ]);
  const pending = await env.DB.prepare("SELECT status FROM telemetry_github_incidents WHERE id = ?")
    .bind(payload.incidentId).first();
  if (pending?.status === "pending") {
    await env.TASK_QUEUE.send({ type: "telemetry_github_issue", incidentId: payload.incidentId, deliveryId: `telemetry:${payload.incidentId}:${now}` });
  }
}

export async function recoverTelemetryGithubIncidents(env) {
  const result = await env.DB.prepare(
    `SELECT incident.id, org.github_login AS owner_id
       FROM telemetry_github_incidents incident JOIN orgs org ON org.id = incident.org_id
      WHERE incident.status IN ('pending', 'failed')
        AND (incident.last_queued_at IS NULL OR datetime(incident.last_queued_at) <= datetime('now', '-10 minutes'))
      ORDER BY incident.updated_at LIMIT 50`,
  ).all();
  for (const row of result.results ?? []) {
    await env.TASK_QUEUE.send({
      type: "telemetry_github_issue",
      incidentId: row.id,
      ownerId: row.owner_id,
      deliveryId: `telemetry:${row.id}:recovery`,
    });
    await env.DB.prepare("UPDATE telemetry_github_incidents SET last_queued_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), row.id).run();
  }
}

function enabledEnvironment(raw, environment) {
  try { return JSON.parse(raw).includes(environment); } catch { return false; }
}

function updateDue(last, minutes) { return !last || Date.now() - Date.parse(last) >= Number(minutes) * 60_000; }
function validRepo(value) { return typeof value === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(value); }
function permanentIncidentFailure(error) {
  const message = errorMessage(error);
  if (message.includes("Telemetry incident has invalid diagnostic payload")) return message;
  if (message.includes("Telemetry returned an invalid incident presentation")) return message;
  return null;
}
function requirePresentation(value) {
  if (!value || value.contract !== "telemetry.response" || value.version !== 1 || value.kind !== "github_incident"
    || typeof value.marker !== "string" || value.marker.length > 320
    || typeof value.title !== "string" || value.title.length > 256
    || typeof value.body !== "string" || value.body.length > 30_000
    || !Array.isArray(value.labels) || value.labels.length > 10
    || value.labels.some((label) => !label || typeof label.name !== "string" || typeof label.color !== "string")
    || (value.latestRelease !== null && value.latestRelease !== undefined && typeof value.latestRelease !== "string")
    || typeof value.repeatComment !== "string" || value.repeatComment.length > 500) {
    throw new Error("Telemetry returned an invalid incident presentation");
  }
  return value;
}
function errorMessage(error) { return (error instanceof Error ? error.message : String(error)).slice(0, 500); }
async function markDisabled(db, id, reason) {
  await db.prepare("UPDATE telemetry_github_incidents SET status = 'disabled', last_error = ?, updated_at = ? WHERE id = ?")
    .bind(reason, new Date().toISOString(), id).run();
}
