import { publishGitHubTransport, publishSlackTransport } from "./transport-outbox";
import { getNoxSpotIssueResponse, getNoxSpotSlackResponse } from "./noxspot-response.js";
import { isAppEnabled } from "./apps.js";
import { storeNoxSpotReport } from "./noxspot-resolution.js";

export async function createNoxSpotGitHubIssue(env, capture) {
  requireCapture(capture);
  if (!(await isAppEnabled(env.DB, capture.orgId, "noxspot"))) {
    return { skipped: "service_disabled", service: "noxspot" };
  }
  const resolvedCapture = await resolveCaptureFromSetup(env.DB, capture);
  const response = await getNoxSpotIssueResponse(env, resolvedCapture);
  if (!resolvedCapture.projectId) throw new Error(`NoxSpot site ${resolvedCapture.siteId} is not linked to a project`);
  const staged = await publishGitHubTransport(env, {
    orgId: resolvedCapture.orgId,
    projectId: resolvedCapture.projectId,
    route: "feedback",
    idempotencyKey: `noxspot:${resolvedCapture.captureId}`,
    operation: "github.issue.create",
    input: { issue: response.issue, idempotencyMarker: response.idempotencyMarker },
    correlationId: resolvedCapture.captureId,
    callback: { kind: "noxspot_issue", payload: resolvedCapture },
  });
  return { outboxId: staged.outboxId, status: staged.status, queued: staged.queued };
}

export async function finalizeNoxSpotGitHubIssue(env, { receipt, payload }) {
  if (receipt.provider !== "github") throw new Error("NoxSpot callback requires a GitHub receipt");
  if (receipt.status !== "delivered") return { skipped: receipt.status };
  if (receipt.result?.resourceType !== "issue") throw new Error("NoxSpot callback requires an issue receipt");
  const issue = {
    number: Number(receipt.result.resourceId),
    html_url: receipt.result.url,
    state: receipt.result.state ?? "open",
  };
  if (!Number.isInteger(issue.number) || issue.number <= 0 || !issue.html_url) throw new Error("NoxSpot issue receipt is incomplete");
  await storeNoxSpotReport(env, payload, issue);
  await storeEvent(env.DB, payload, issue);
  const slackResponse = await getNoxSpotSlackResponse(env, payload, issue);
  await publishSlackTransport(env, {
    orgId: payload.orgId,
    projectId: payload.projectId,
    route: "feedback",
    routeContext: { kind: "site", id: payload.siteId },
    idempotencyKey: `noxspot:${payload.captureId}`,
    message: slackResponse.message,
  });
  return { number: issue.number, url: issue.html_url };
}

async function resolveCaptureFromSetup(db, capture) {
  const site = await db.prepare(
    `SELECT site.name AS site_name, site.repo, site.project_id,
            site.slack_channel_id, site.slack_connection_id,
            org.github_login AS owner_id
       FROM spot_sites site
       JOIN orgs org ON org.id = site.org_id
      WHERE site.id = ? AND site.org_id = ?
      LIMIT 1`,
  ).bind(capture.siteId, capture.orgId).first();
  if (!site?.owner_id || !site?.repo) {
    throw new Error(`NoxSpot site ${capture.siteId} is not configured for org ${capture.orgId}`);
  }

  const resolved = {
    ...capture,
    ownerId: site.owner_id,
    repo: site.repo,
    projectId: site.project_id ?? null,
    siteName: site.site_name ?? capture.siteId,
    slackChannelId: site.slack_channel_id ?? null,
    slackConnectionId: site.slack_connection_id ?? null,
  };
  if (!capture.reporter) return resolved;
  const requestedLogin = String(capture.reporter).trim().replace(/^@/, '');
  if (!requestedLogin) return resolved;
  const member = await db.prepare(
    `SELECT login FROM members
      WHERE org_id = ? AND kind = 'human' AND lower(login) = lower(?)
      LIMIT 1`,
  ).bind(capture.orgId, requestedLogin).first();
  return member?.login
    ? { ...resolved, reporterGithubLogin: member.login }
    : resolved;
}

function requireCapture(capture) {
  // Version-less tasks are accepted temporarily so messages produced by the
  // legacy NoxSpot Worker can drain during cutover. Every NoxConnect-owned
  // producer emits version 1; unknown explicit versions fail into Queue retry
  // and the DLQ instead of being interpreted with the wrong contract.
  if (capture?.version !== undefined && capture.version !== 1) {
    throw new Error(`Unsupported NoxSpot capture version: ${capture.version}`);
  }
  // Repository and routing identity are deliberately resolved again from the
  // organization-scoped site row instead of trusting Queue input.
  for (const field of ["captureId", "orgId", "siteId", "title"]) {
    if (!capture?.[field]) throw new Error(`Invalid NoxSpot capture: missing ${field}`);
  }
}

async function storeEvent(db, capture, issue) {
  await db.prepare(
    `INSERT INTO events
       (delivery_id, source, type, actor_id, project_id, org, repo, summary, payload_json, owner_id)
     VALUES (?, 'noxspot', 'spot:issue_created', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(delivery_id) DO UPDATE SET
       summary = excluded.summary, payload_json = excluded.payload_json`,
  ).bind(
    capture.deliveryId || `noxspot:${capture.captureId}`,
    capture.reporterGithubLogin || capture.reporter || "anonymous",
    capture.projectId || null,
    capture.ownerId,
    capture.repo,
    capture.title,
    JSON.stringify({
      product: "noxspot",
      issueId: String(issue.number),
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      siteId: capture.siteId,
      siteName: capture.siteName,
      issueType: capture.issueType,
      description: capture.description ?? null,
      reporter: capture.reporterGithubLogin || capture.reporter || null,
      captureId: capture.captureId,
      notificationRequested: capture.notifyOnResolution === true && Boolean(capture.reporterEmail),
      screenshotUrl: capture.screenshotUrl ?? null,
      shareUrl: issue.html_url,
    }),
    capture.ownerId,
  ).run();
}
