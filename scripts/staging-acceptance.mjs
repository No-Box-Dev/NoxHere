#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { findTelemetryEvent, findIssue, findRelease, marker, mergePullRequestWithRefresh, validateSafety } from "./staging-acceptance-lib.mjs";

const preflightOnly = process.argv.includes("--preflight");
const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const runMarker = marker(runId);
const markers = {
  ticket: `${runMarker} planning`,
  feed: `${runMarker} activity`,
  cue: `${runMarker} telemetry`,
  spot: `${runMarker} feedback`,
};
const config = {
  baseUrl: process.env.NOX_ACCEPTANCE_BASE_URL ?? "",
  org: process.env.NOX_ACCEPTANCE_ORG ?? "",
  projectId: process.env.NOX_ACCEPTANCE_PROJECT_ID ?? "",
  repo: process.env.NOX_ACCEPTANCE_REPO ?? "",
  slackConnectionId: process.env.NOX_ACCEPTANCE_SLACK_CONNECTION_ID ?? "",
  slackChannelId: process.env.NOX_ACCEPTANCE_SLACK_CHANNEL_ID ?? "",
  apiToken: process.env.NOX_ACCEPTANCE_API_TOKEN ?? "",
  feedbackUrl: process.env.NOX_ACCEPTANCE_FEEDBACK_URL ?? "",
  feedbackOrigin: process.env.NOX_ACCEPTANCE_FEEDBACK_ORIGIN ?? "",
  feedbackSiteId: process.env.NOX_ACCEPTANCE_FEEDBACK_SITE_ID ?? "",
  telemetrySourceId: process.env.NOX_ACCEPTANCE_TELEMETRY_SOURCE_ID ?? "",
  telemetryIngestKey: process.env.NOX_ACCEPTANCE_TELEMETRY_INGEST_KEY ?? "",
  confirm: process.env.NOX_ACCEPTANCE_CONFIRM ?? "",
};

const safetyErrors = validateSafety(config, { writes: !preflightOnly });
if (safetyErrors.length) fail(`Safety check failed:\n- ${safetyErrors.join("\n- ")}`);

const baseUrl = new URL(config.baseUrl);
const feedbackUrl = new URL(config.feedbackUrl);
const checks = [];
let telemetryIssue = null;
let spotIssue = null;
let activityPull = null;
let activityBranch = null;

function fail(message) { throw new Error(message); }
function pass(name, detail = "") {
  checks.push(name);
  process.stdout.write(`PASS ${name}${detail ? ` — ${detail}` : ""}\n`);
}

async function request(name, path, init = {}, expected = [200]) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.apiToken}`);
  headers.set("X-Org", config.org);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!expected.includes(response.status)) {
    fail(`${name}: expected ${expected.join("/")}, received ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  pass(name, String(response.status));
  return { response, body };
}

function gh(name, method, path, fields = {}) {
  const args = ["api", "--method", method, path];
  for (const [key, value] of Object.entries(fields)) args.push("-f", `${key}=${value}`);
  const result = spawnSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) fail(`${name}: GitHub CLI failed (${result.stderr.trim() || `exit ${result.status}`})`);
  let body = null;
  try { body = result.stdout ? JSON.parse(result.stdout) : null; } catch { body = result.stdout; }
  return body;
}

async function poll(name, load, accept, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await load();
    const accepted = accept(latest);
    if (accepted) { pass(name); return accepted; }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  fail(`${name}: timed out after ${Math.round(timeoutMs / 1000)}s; last response ${JSON.stringify(latest)}`);
}

function githubIssues() {
  return gh("list acceptance issues", "GET", `repos/${config.org}/${config.repo}/issues`, { state: "all", per_page: "100" });
}

function closeGithubIssue(issue) {
  if (!issue?.number) return;
  gh(`close GitHub issue #${issue.number}`, "PATCH", `repos/${config.org}/${config.repo}/issues/${issue.number}`, { state: "closed" });
}

function cleanupActivityFixture() {
  if (activityPull?.number) {
    const pull = gh(`read Activity acceptance pull request #${activityPull.number}`, "GET", `repos/${config.org}/${config.repo}/pulls/${activityPull.number}`);
    if (pull?.state === "open") {
      gh(`close Activity acceptance pull request #${activityPull.number}`, "PATCH", `repos/${config.org}/${config.repo}/pulls/${activityPull.number}`, { state: "closed" });
    }
  }
  if (activityBranch) {
    gh(`delete Activity acceptance branch ${activityBranch}`, "DELETE", `repos/${config.org}/${config.repo}/git/refs/heads/${activityBranch}`);
  }
  activityPull = null;
  activityBranch = null;
}

async function preflight() {
  const health = await fetch(new URL("/__noxhere/health", baseUrl));
  const healthBody = await health.json().catch(() => null);
  if (health.status !== 200 || healthBody?.service !== "noxhere" || healthBody?.plane !== "public-platform") {
    fail(`NoxHere staging health failed: ${health.status}`);
  }
  pass("NoxHere staging gateway health", "200");

  await request("NoxHere staging readiness", "/api/health/ready");
  const catalog = (await request("service discovery", "/api/v1/services")).body;
  for (const id of ["noxhere", "planning", "activity", "feedback", "telemetry"]) {
    const service = catalog?.services?.find((candidate) => candidate.id === id);
    if (!service) fail(`service discovery: ${id} is missing`);
    if (service.enabled === false) fail(`service discovery: ${id} is disabled`);
    if (id !== "noxhere" && service.runtime?.state !== "ready") {
      fail(`service discovery: ${id} runtime is ${service.runtime?.state ?? "unknown"}`);
    }
  }
  pass("all product service bindings are ready");

  if (catalog?.project?.id !== config.projectId) {
    fail(`service discovery: expected project ${config.projectId}, received ${catalog?.project?.id ?? "none"}`);
  }
  pass("acceptance token is bound to the staging project", config.projectId);

  const ticketConfig = (await request("Planning staging config", "/api/v1/services/planning/config")).body?.config;
  if (ticketConfig?.featureRepository !== config.repo) fail("Planning feature repository is not the allowlisted staging repository");
  const feedConfig = (await request("Activity staging config", "/api/v1/services/activity/config")).body?.config;

  const repo = gh("read staging repository", "GET", `repos/${config.org}/${config.repo}`);
  if (repo?.owner?.login?.toLowerCase() !== config.org.toLowerCase() || repo?.name !== config.repo) {
    fail("GitHub staging repository identity does not match the allowlist");
  }
  if (!repo.private || repo.archived) {
    fail("GitHub acceptance repository must be private and active");
  }
  pass("GitHub acceptance repository is reachable", repo.full_name);

  const slack = (await request(
    "Slack acceptance channel discovery",
    `/api/v1/slack/channels?connectionId=${encodeURIComponent(config.slackConnectionId)}`,
  )).body;
  const channel = slack?.channels?.find((item) => item.id === config.slackChannelId);
  if (slack?.connectionId !== config.slackConnectionId || !channel || channel.is_archived) {
    fail("Slack acceptance destination must be an active channel on the explicitly selected connection");
  }
  pass("Slack acceptance destination is explicitly selected", `#${channel.name}`);

  const spotConfigResponse = await fetch(new URL(`/api/feedback/public/v1/sites/${encodeURIComponent(config.feedbackSiteId)}/config`, feedbackUrl), {
    headers: { Origin: config.feedbackOrigin, Accept: "application/json" },
  });
  if (!spotConfigResponse.ok) fail(`Feedback site preflight failed: ${spotConfigResponse.status} ${await spotConfigResponse.text()}`);
  pass("Feedback staging site accepts the staging origin", String(spotConfigResponse.status));
  const spotMembersResponse = await fetch(new URL(`/api/feedback/public/v1/sites/${encodeURIComponent(config.feedbackSiteId)}/members`, feedbackUrl), {
    headers: { Origin: config.feedbackOrigin, Accept: "application/json" },
  });
  if (!spotMembersResponse.ok) fail(`Feedback member directory failed: ${spotMembersResponse.status} ${await spotMembersResponse.text()}`);
  const spotMembers = await spotMembersResponse.json();
  if (!Array.isArray(spotMembers?.members)) fail("Feedback member directory returned an invalid response");
  pass("Feedback staging member directory accepts the staging origin", String(spotMembersResponse.status));
  const spotSites = (await request("Feedback site discovery", "/api/v1/feedback/sites")).body?.sites;
  const spotSite = spotSites?.find((item) => item.id === config.feedbackSiteId && item.projectId === config.projectId && item.repo === config.repo);
  if (!spotSite
    || spotSite.slackConnectionId !== config.slackConnectionId
    || spotSite.slackEffectiveChannelId !== config.slackChannelId) {
    fail("Feedback staging site is not project-scoped to the acceptance Slack channel");
  }

  const sources = (await request("Telemetry source discovery", "/api/v1/telemetry/sources")).body?.sources;
  const source = sources?.find((item) => item.id === config.telemetrySourceId && item.projectId === config.projectId);
  if (!source || !source.enabled || source.environment !== "staging") fail("Telemetry staging source is missing, disabled, or not scoped to staging");
  if (source.effectiveAlertSlackChannelId !== config.slackChannelId
    || source.effectiveAlertSlackConnectionId !== config.slackConnectionId) {
    fail("Telemetry staging source is not routed to the acceptance Slack destination");
  }
  pass("Telemetry staging source is enabled", config.telemetrySourceId);
  const incidentProjects = (await request("Telemetry GitHub incident policy", "/api/v1/telemetry/github-issues")).body?.projects;
  const incidentProject = incidentProjects?.find((item) => item.projectId === config.projectId && item.repo === config.repo);
  if (!incidentProject?.enabled || !incidentProject.environments?.includes("staging")) {
    fail("Telemetry GitHub incidents are not enabled for the staging project/environment");
  }
  pass("Telemetry staging GitHub incident policy is enabled");
}

async function slackAcceptance() {
  for (const kind of ["planning", "activity_release_notes", "telemetry"]) {
    await request(`Slack provider write for ${kind}`, "/api/v1/slack/test", {
      method: "POST",
      body: JSON.stringify({
        connectionId: config.slackConnectionId,
        channelId: config.slackChannelId,
        kind,
      }),
    });
  }
}

async function planningAcceptance() {
  const created = (await request("Planning creates an app-owned feature", "/api/v1/features", {
    method: "POST",
    headers: { "Idempotency-Key": `acceptance-ticket-${runId}` },
    body: JSON.stringify({ title: `Acceptance feature ${markers.ticket}`, status: "todo", backlog: true }),
  }, [201])).body;
  const number = Number(created?.number);
  if (!number || !String(created?.title ?? "").includes(markers.ticket)) fail("Planning returned an invalid feature receipt");
  const features = (await request("Planning lists the created feature", "/api/v1/features?state=open")).body;
  const items = Array.isArray(features) ? features : features?.features;
  if (!items?.some((feature) => Number(feature.number) === number && String(feature.title).includes(markers.ticket))) {
    fail("Planning did not persist the created feature");
  }
  pass("Planning app-owned feature persisted", `#${number}`);
  await request("Planning closes the acceptance feature", `/api/v1/features/${number}`, { method: "DELETE" }, [200, 204]);
}

async function activityAcceptance() {
  const repository = gh("read Activity staging repository", "GET", `repos/${config.org}/${config.repo}`);
  const base = repository.default_branch;
  const baseRef = gh("read Activity base ref", "GET", `repos/${config.org}/${config.repo}/git/ref/heads/${base}`);
  const branch = `nox-acceptance/${runId}`;
  activityBranch = branch;
  gh("create Activity acceptance branch", "POST", `repos/${config.org}/${config.repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: baseRef.object.sha,
  });
  gh("create Activity acceptance commit", "PUT", `repos/${config.org}/${config.repo}/contents/.nox-acceptance/${runId}.md`, {
    message: `Acceptance fixture ${markers.feed}`,
    content: Buffer.from(`${markers.feed}\n`).toString("base64"),
    branch,
  });
  const pull = gh("create Activity acceptance pull request", "POST", `repos/${config.org}/${config.repo}/pulls`, {
    title: `Acceptance release ${markers.feed}`,
    head: branch,
    base,
    body: `Automated staging-only provider acceptance. ${markers.feed}`,
  });
  activityPull = pull;
  await mergePullRequestWithRefresh(gh, config.org, config.repo, pull.number);
  pass("Activity staging pull request merged", `#${pull.number}`);
  await poll("Activity release note observed through the public API", async () => (
    await request("poll Activity release notes", `/api/v1/activity?mode=release-notes&repo=${encodeURIComponent(config.repo)}&limit=50`)
  ).body, (body) => findRelease(body?.events, config.repo, pull.number, markers.feed));
}

async function telemetryAcceptance() {
  const response = await fetch(new URL("/api/v1/telemetry/public/events", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Nox-Ingest-Key": config.telemetryIngestKey,
      "Idempotency-Key": `acceptance-cue-${runId}`,
    },
    body: JSON.stringify({
      version: 1,
      type: "error.occurred",
      title: `Acceptance error ${markers.cue}`,
      message: "Staging-only Telemetry provider acceptance event.",
      idempotencyKey: `acceptance-cue-${runId}`,
      occurredAt: new Date().toISOString(),
      url: config.feedbackOrigin,
      data: {
        errorCode: "NOX_ACCEPTANCE",
        environment: "staging",
        component: "acceptance-suite",
        fatal: false,
        unhandled: false,
        attributes: { notifyEveryOccurrence: true, acceptanceRunId: runId },
      },
    }),
  });
  if (![200, 201, 202].includes(response.status)) fail(`Telemetry ingest failed: ${response.status} ${await response.text()}`);
  pass("Telemetry staging event accepted", String(response.status));
  await poll("Telemetry event and Slack receipt observed", async () => (
    await request("poll Telemetry events", `/api/v1/telemetry/events?sourceId=${encodeURIComponent(config.telemetrySourceId)}&limit=50`)
  ).body, (body) => {
    const event = findTelemetryEvent(body?.events, markers.cue);
    return event?.deliveryStatus === "delivered" ? event : null;
  });
  telemetryIssue = await poll("Telemetry GitHub incident observed", async () => githubIssues(), (items) => findIssue(items, markers.cue));
}

async function feedbackAcceptance() {
  const before = (await request("read Feedback delivery baseline", "/api/v1/feedback/sites")).body?.sites
    ?.find((site) => site.id === config.feedbackSiteId)?.slackLastDeliveredAt ?? null;
  const response = await fetch(new URL("/api/feedback/public/v1/reports", feedbackUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: config.feedbackOrigin,
      "Idempotency-Key": `acceptance-spot-${runId}`,
    },
    body: JSON.stringify({
      attemptId: `acceptance-spot-${runId}`,
      siteId: config.feedbackSiteId,
      title: `Acceptance feedback ${markers.spot}`,
      description: "Staging-only Feedback provider acceptance report.",
      type: "feedback",
      environment: "staging",
      metadata: { suite: "nox-staging-provider-acceptance", runId },
    }),
  });
  if (response.status !== 200) fail(`Feedback report failed: ${response.status} ${await response.text()}`);
  pass("Feedback staging report queued", "200");
  spotIssue = await poll("Feedback GitHub issue observed", async () => githubIssues(), (items) => findIssue(items, markers.spot));
  await poll("Feedback Slack delivery receipt observed", async () => (
    await request("poll Feedback site receipt", "/api/v1/feedback/sites")
  ).body, (body) => {
    const site = body?.sites?.find((item) => item.id === config.feedbackSiteId);
    return site && site.slackHealth === "connected" && site.slackLastDeliveredAt && site.slackLastDeliveredAt !== before ? site : null;
  });
}

async function cleanup() {
  closeGithubIssue(telemetryIssue);
  closeGithubIssue(spotIssue);
  cleanupActivityFixture();
}

try {
  process.stdout.write(`Nox staging acceptance ${runMarker}\n`);
  await preflight();
  if (preflightOnly) {
    process.stdout.write(`\nPASS: ${checks.length} staging preflight checks completed; no provider writes were made.\n`);
  } else {
    await slackAcceptance();
    await planningAcceptance();
    await activityAcceptance();
    await telemetryAcceptance();
    await feedbackAcceptance();
    await cleanup();
    process.stdout.write(`\nPASS: ${checks.length} staging checks completed, including real GitHub and Slack provider writes.\n`);
  }
} catch (error) {
  process.stderr.write(`\nFAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  try { await cleanup(); } catch (cleanupError) {
    process.stderr.write(`Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}\n`);
  }
  process.exitCode = 1;
}
