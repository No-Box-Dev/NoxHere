#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { encryptToken } from "../functions/lib/crypto.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDist = join(root, "apps/web/dist");
const telemetryDir = resolve(process.env.TELEMETRY_DIR || join(root, "services/telemetry"));
const activityDir = resolve(process.env.ACTIVITY_SERVICE_DIR || join(root, "services/activity"));
const feedbackDir = resolve(process.env.FEEDBACK_CAPTURE_DIR || join(root, "services/feedback"));
const planningDir = resolve(process.env.PLANNING_SERVICE_DIR || join(root, "services/planning"));
const capabilityDir = join(root, "services/connections");
const coreApiConfig = join(root, "services/core-api/wrangler.jsonc");
const wrangler = join(root, "node_modules/.bin/wrangler");
const keepState = process.argv.includes("--keep-state");
const allowAuthSkip = process.argv.includes("--allow-auth-skip");
const portOffset = Number.parseInt(process.env.NOXHERE_E2E_PORT_OFFSET || "0", 10);
if (!Number.isInteger(portOffset) || portOffset < 0 || portOffset > 50_000) {
  throw new Error("NOXHERE_E2E_PORT_OFFSET must be an integer from 0 through 50000");
}
const port = (defaultPort) => defaultPort + portOffset;
const org = process.env.NOXHERE_E2E_ORG || "No-Box-Dev";
const repo = process.env.NOXHERE_E2E_REPO || "noxhere";
const projectId = `proj_${org}_${repo}`.toLowerCase();
const otherProjectId = `${projectId}_other`;
const otherRepo = `${repo}-other`;
const base = `http://127.0.0.1:${port(8788)}`;
const internalSecret = randomBytes(32).toString("base64url");
const stateRoot = mkdtempSync(join(tmpdir(), "noxhere-local-e2e-"));
const runId = randomBytes(5).toString("hex");
const serviceNames = {
  capabilities: `noxhere-connections-e2e-${runId}`,
  cue: `telemetry-e2e-${runId}`,
  spot: `feedback-e2e-${runId}`,
  feed: `activity-e2e-${runId}`,
  ticket: `planning-e2e-${runId}`,
  background: `noxhere-orchestrator-e2e-${runId}`,
  rpc: `noxhere-rpc-e2e-${runId}`,
};
const persistence = join(stateRoot, "state");
const logsDir = join(stateRoot, "logs");
const rpcDir = join(stateRoot, "rpc-smoke");
const children = [];
const results = [];
let failed = false;
let stopping = false;

mkdirSync(persistence, { recursive: true });
mkdirSync(logsDir, { recursive: true });

function print(message) {
  process.stdout.write(`${message}\n`);
}

function checkPrerequisites() {
  const required = [
    [wrangler, "Run npm install in NoxHere"],
    [coreApiConfig, "Restore the core API Wrangler configuration"],
    [join(webDist, "index.html"), "Run npm run build:web in NoxHere"],
    [join(telemetryDir, "wrangler.jsonc"), "Run npm ci in services/telemetry"],
    [join(telemetryDir, "node_modules"), "Run npm ci in services/telemetry"],
    [join(activityDir, "wrangler.toml"), "Run npm ci in services/activity"],
    [join(activityDir, "node_modules"), "Run npm ci in services/activity"],
    [join(feedbackDir, "node_modules"), "Run npm ci in services/feedback"],
    [join(planningDir, "node_modules"), "Run npm ci in services/planning"],
  ];
  const missing = required.filter(([path]) => !existsSync(path));
  if (missing.length) {
    throw new Error(missing.map(([path, help]) => `Missing ${path}. ${help}.`).join("\n"));
  }
}

function run(label, command, args, options = {}) {
  print(`→ ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...options.env, CI: "1", NO_COLOR: "1" },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(`${label} failed (${result.status})${output ? `:\n${output}` : ""}`);
  }
  results.push(label);
  return (result.stdout || "").trim();
}

function start(name, cwd, args) {
  const logPath = join(logsDir, `${name}.log`);
  const log = createWriteStream(logPath, { flags: "a", mode: 0o600 });
  const child = spawn(wrangler, args, {
    cwd,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Both streams share one file. Neither may close it while the other can
  // still emit teardown output; stopChildren owns the final close.
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  children.push({ name, child, log, logPath });
  child.on("exit", (code, signal) => {
    if (!stopping && !failed && code !== null && code !== 0) {
      failed = true;
      print(`✗ ${name} exited early (${code ?? signal})`);
    }
  });
  return child;
}

async function waitFor(name, url, { timeoutMs = 45_000, expected = 200 } = {}) {
  const started = Date.now();
  let last = "not reachable";
  while (Date.now() - started < timeoutMs) {
    const proc = children.find((entry) => entry.name === name)?.child;
    if (proc?.exitCode !== null) break;
    try {
      const response = await fetch(url);
      if (response.status === expected) {
        results.push(`${name} is reachable`);
        print(`✓ ${name} is reachable`);
        return response;
      }
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`${name} did not become ready: ${last}`);
}

async function request(label, path, options = {}, expected = 200) {
  const { noxHereAuth, ...fetchOptions } = options;
  if (noxHereAuth) {
    const method = (fetchOptions.method || "GET").toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const assertion = {
      version: 1, issuer: "noxhere", audience: "noxhere",
      issuedAt: now, expiresAt: now + 30, method, path, auth: noxHereAuth,
    };
    const payload = Buffer.from(JSON.stringify(assertion)).toString("base64url");
    const signature = createHmac("sha256", internalSecret).update(payload).digest("base64url");
    const headers = new Headers(fetchOptions.headers);
    headers.set("X-NoxHere-Internal-Assertion", payload);
    headers.set("X-NoxHere-Internal-Signature", signature);
    fetchOptions.headers = headers;
  }
  const response = await fetch(path.startsWith("http") ? path : `${base}${path}`, fetchOptions);
  const raw = await response.text();
  let body = raw;
  if ((response.headers.get("content-type") || "").includes("json")) {
    try { body = JSON.parse(raw); } catch { /* assertion below reports raw */ }
  }
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status)) {
    throw new Error(`${label}: expected HTTP ${statuses.join("/")}, got ${response.status}: ${raw.slice(0, 500)}`);
  }
  if (path.startsWith("/api/v1/")) {
    if (response.headers.get("cache-control") !== "no-store") {
      throw new Error(`${label}: canonical API response is missing Cache-Control: no-store`);
    }
    if (!response.headers.get("link")?.includes("/openapi.json")) {
      throw new Error(`${label}: canonical API response is missing the OpenAPI discovery link`);
    }
    if (response.status >= 400 && (body?.apiVersion !== 1 || typeof body?.error?.code !== "string")) {
      throw new Error(`${label}: canonical API error did not use the v1 coded envelope: ${raw.slice(0, 500)}`);
    }
  }
  results.push(label);
  print(`✓ ${label} (${response.status})`);
  return { response, body };
}

function signedOptions(auth, init = {}) {
  return {
    ...init,
    noxHereAuth: auth,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  };
}

function tail(path, lines = 35) {
  try { return readFileSync(path, "utf8").split("\n").slice(-lines).join("\n"); }
  catch { return "(log unavailable)"; }
}

async function stopChildren() {
  stopping = true;
  for (const { child } of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  await Promise.race([
    Promise.all(children.map(({ child }) => new Promise((resolveExit) => {
      if (child.exitCode !== null) resolveExit();
      else child.once("exit", resolveExit);
    }))),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  for (const { child, log } of children) {
    if (child.exitCode === null) child.kill("SIGKILL");
    log.end();
  }
}

function makeRpcSmokeWorker() {
  mkdirSync(rpcDir, { recursive: true });
  writeFileSync(join(rpcDir, "wrangler.jsonc"), JSON.stringify({
    name: serviceNames.rpc,
    main: "index.js",
    compatibility_date: "2026-09-09",
    services: [
      { binding: "FEEDBACK", service: serviceNames.spot },
      { binding: "TELEMETRY", service: serviceNames.cue },
      { binding: "ACTIVITY", service: serviceNames.feed },
      { binding: "PLANNING", service: serviceNames.ticket },
    ],
  }, null, 2), { mode: 0o600 });
  writeFileSync(join(rpcDir, "index.js"), `export default {
  async fetch(_request, env) {
    const [feedback, telemetry, activity, planning] = await Promise.all([
      env.FEEDBACK.describe(),
      env.TELEMETRY.describe(),
      env.ACTIVITY.describe(),
      env.PLANNING.describe(),
    ]);
    return Response.json({ feedback, telemetry, activity, planning });
  }
};\n`, { mode: 0o600 });
}

async function main() {
  print(`Local E2E state: ${stateRoot}`);
  checkPrerequisites();

  run("apply all NoxHere migrations to a fresh local D1", wrangler, [
    "d1", "migrations", "apply", "DB", "--config", coreApiConfig,
    "--env=", "--local", "--persist-to", persistence,
  ]);
  run("apply Ticket migrations to its fresh local D1", wrangler, [
    "d1", "migrations", "apply", "DB", "--local", "--persist-to", persistence,
  ], { cwd: planningDir });
  const fixtureSql = [
    `INSERT INTO orgs (id, github_login) VALUES (910004, '${org.replaceAll("'", "''")}');`,
    `INSERT INTO installations (installation_id, owner_id, account_login, account_type, repos_json, installed_at, updated_at) VALUES (910004, '${org.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', 'Organization', '["${org.replaceAll('"', '\\"')}/${repo.replaceAll('"', '\\"')}"]', unixepoch(), unixepoch());`,
    `INSERT INTO projects (id, name, org, repo, owner_id, org_id) VALUES ('${projectId.replaceAll("'", "''")}', '${repo.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', '${repo.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', 910004);`,
    `INSERT INTO project_routing_settings (org_id, project_id, enabled) VALUES (910004, '${projectId.replaceAll("'", "''")}', 1);`,
    `INSERT INTO project_repositories (org_id, repo, project_id) VALUES (910004, '${repo.replaceAll("'", "''")}', '${projectId.replaceAll("'", "''")}');`,
    `INSERT INTO projects (id, name, org, repo, owner_id, org_id) VALUES ('${otherProjectId.replaceAll("'", "''")}', '${otherRepo.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', '${otherRepo.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', 910004);`,
    `INSERT INTO project_routing_settings (org_id, project_id, enabled) VALUES (910004, '${otherProjectId.replaceAll("'", "''")}', 1);`,
    `INSERT INTO project_repositories (org_id, repo, project_id) VALUES (910004, '${otherRepo.replaceAll("'", "''")}', '${otherProjectId.replaceAll("'", "''")}');`,
    `INSERT INTO events (delivery_id, source, type, project_id, org, repo, summary, technical_summary, payload_json, owner_id) VALUES ('local-feed-allowed', 'github', 'narrative', '${projectId.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', '${repo.replaceAll("'", "''")}', 'allowed project event', 'allowed', '{"trigger_type":"github:pr:merged","pr":{"number":1,"title":"Allowed","html_url":"https://example.test/allowed","author":{"login":"local"}}}', '${org.replaceAll("'", "''")}');`,
    `INSERT INTO events (delivery_id, source, type, project_id, org, repo, summary, technical_summary, payload_json, owner_id) VALUES ('local-feed-denied', 'github', 'narrative', '${otherProjectId.replaceAll("'", "''")}', '${org.replaceAll("'", "''")}', '${otherRepo.replaceAll("'", "''")}', 'other project event', 'denied', '{"trigger_type":"github:pr:merged","pr":{"number":2,"title":"Denied","html_url":"https://example.test/denied","author":{"login":"local"}}}', '${org.replaceAll("'", "''")}');`,
  ].join(" ");
  run("seed a credential-free local organization and project", wrangler, [
    "d1", "execute", "DB", "--config", coreApiConfig,
    "--env=", "--local", "--persist-to", persistence, "--command", fixtureSql,
  ]);

  const encryptionKey = randomBytes(32).toString("hex");
  const webhookSecret = randomBytes(32).toString("hex");
  const commonDev = ["--local", "--persist-to", persistence, "--log-level", "warn", "--show-interactive-dev-session=false"];
  start("capabilities", capabilityDir, [
    "dev", "--name", serviceNames.capabilities, "--port", String(port(8796)),
    "--inspector-port", String(port(9236)), "--var", `ENCRYPTION_KEY:${encryptionKey}`,
    "--var", `GITHUB_WEBHOOK_SECRET:${webhookSecret}`, ...commonDev,
  ]);
  await waitFor("capabilities", `http://127.0.0.1:${port(8796)}/`, { expected: 404 });
  start("telemetry", telemetryDir, ["dev", "--name", serviceNames.cue, "--port", String(port(8792)), "--inspector-port", String(port(9232)), ...commonDev]);
  await waitFor("telemetry", `http://127.0.0.1:${port(8792)}/health`);
  start("feedback", feedbackDir, ["dev", "--name", serviceNames.spot, "--port", String(port(8790)), "--inspector-port", String(port(9229)), ...commonDev]);
  await waitFor("feedback", `http://127.0.0.1:${port(8790)}/health`);
  start("activity", activityDir, ["dev", "--name", serviceNames.feed, "--port", String(port(8791)), "--inspector-port", String(port(9230)), ...commonDev]);
  await waitFor("activity", `http://127.0.0.1:${port(8791)}/health`);
  start("planning", planningDir, ["dev", "--name", serviceNames.ticket, "--port", String(port(8795)), "--inspector-port", String(port(9235)), ...commonDev]);
  await waitFor("planning", `http://127.0.0.1:${port(8795)}/health`);

  start("background", root, ["dev", "-c", "services/scheduler/wrangler.toml", "--name", serviceNames.background, "--port", String(port(8794)), "--inspector-port", String(port(9234)), ...commonDev]);
  makeRpcSmokeWorker();
  start("rpc", rpcDir, ["dev", "-c", "wrangler.jsonc", "--port", String(port(8793)), "--inspector-port", String(port(9233)), ...commonDev]);

  start("noxhere", root, [
    "pages", "dev", webDist, "--port", String(port(8788)), "--inspector-port", String(port(9231)),
    "--persist-to", persistence, "--log-level", "warn", "--show-interactive-dev-session=false",
    "--d1", "DB=c94084e6-d0be-423c-8de6-249e7cf8bf25",
    "--binding", `ENCRYPTION_KEY=${encryptionKey}`,
    "--binding", `GITHUB_WEBHOOK_SECRET=${webhookSecret}`,
    "--binding", `NOXHERE_INTERNAL_SECRET=${internalSecret}`,
    "--service", `FEEDBACK_RESPONSE=${serviceNames.spot}`,
    "--service", `TELEMETRY_RESPONSE=${serviceNames.cue}`,
    "--service", `TELEMETRY_INGEST=${serviceNames.cue}`,
    "--service", `ACTIVITY_RESPONSE=${serviceNames.feed}`,
    "--service", `PLANNING_SERVICE=${serviceNames.ticket}`,
    "--service", `NOXHERE_EMAIL=${serviceNames.capabilities}`,
  ]);
  await waitFor("noxhere", `${base}/developers`);
  await waitFor("rpc", `http://127.0.0.1:${port(8793)}/`);
  await waitFor("background", `http://127.0.0.1:${port(8794)}/`, { expected: 404 });

  const docs = await request("developer documentation HTML", "/developers");
  if (!String(docs.body).includes("NoxHere API")) throw new Error("Developer documentation is missing its title");
  await request("OpenAPI contract", "/openapi.json");
  await request("developer documentation JavaScript", "/developers.js");
  const rpc = await request("private RPC contracts for all product services", `http://127.0.0.1:${port(8793)}/`);
  for (const service of ["feedback", "telemetry", "activity", "planning"]) {
    if (rpc.body?.[service]?.contract !== "nox.service-manifest" || rpc.body[service].version !== 1) throw new Error(`Invalid ${service} RPC contract`);
  }

  await request("protected API rejects an anonymous caller", "/api/v1/services", {}, 401);
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8", env: process.env });
  const token = gh.status === 0 ? gh.stdout.trim() : "";
  if (!token) {
    if (!allowAuthSkip) throw new Error("GitHub CLI authentication is required. Run gh auth login, or pass --allow-auth-skip for public-only checks.");
    print("! Authenticated API checks skipped (--allow-auth-skip)");
    return;
  }

  const loginResult = spawnSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf8", env: process.env });
  const githubLogin = loginResult.status === 0 ? loginResult.stdout.trim() : "";
  if (!githubLogin) throw new Error("Could not resolve the authenticated GitHub login");
  const userIdResult = spawnSync("gh", ["api", "user", "--jq", ".id"], { encoding: "utf8", env: process.env });
  const githubUserId = Number(userIdResult.status === 0 ? userIdResult.stdout.trim() : "");
  if (!Number.isSafeInteger(githubUserId)) throw new Error("Could not resolve the authenticated GitHub user ID");
  const connectionId = `noxic_local_${randomBytes(8).toString("hex")}`;
  const encryptedGitHubToken = await encryptToken(token, encryptionKey);
  const authFixtureSql = [
    `INSERT OR IGNORE INTO org_admins (org_id, login, granted_by_login) VALUES (910004, '${githubLogin.replaceAll("'", "''")}', '${githubLogin.replaceAll("'", "''")}');`,
    `INSERT INTO identity_connections (id, github_user_id, github_login, encrypted_access_token) VALUES ('${connectionId}', ${githubUserId}, '${githubLogin.replaceAll("'", "''")}', '${encryptedGitHubToken}');`,
  ].join(" ");
  run("seed a connector identity without creating a NoxHere login session", wrangler, [
    "d1", "execute", "DB", "--config", coreApiConfig,
    "--env=", "--local", "--persist-to", persistence, "--command", authFixtureSql,
  ]);

  const sessionAuth = {
    credentialType: "session", credentialId: "local-session", principalId: `github:${githubUserId}`,
    userLogin: githubLogin, userId: githubUserId, orgId: 910004, orgLogin: org,
    isAdmin: true, projectId: null, scopes: [], connectionId,
  };
  const projectAuth = {
    ...sessionAuth, credentialType: "api_token", credentialId: "local-project-token",
    projectId, scopes: ["services:read", "activity:read", "feedback:write", "telemetry:write"], connectionId: null,
  };
  await request("signed NoxHere session authenticates without exposing a provider bearer", "/api/v1/services", signedOptions(sessionAuth));
  await request("GitHub provider bearer is not a NoxHere API credential", "/api/v1/services", { headers: { Authorization: `Bearer ${token}` } }, 401);
  await request("signed NoxHere session reads its organization role", "/api/v1/me", signedOptions(sessionAuth));
  await request("signed NoxHere session reads integration readiness", "/api/v1/integrations/status", signedOptions(sessionAuth));
  await request("signed NoxHere session reads bootstrap status", "/api/v1/bootstrap-status", signedOptions(sessionAuth));
  await request("signed NoxHere session reads detailed events", "/api/v1/events?limit=1", signedOptions(sessionAuth));
  await request("signed NoxHere session reads engineer counts", "/api/v1/engineer-stats", signedOptions(sessionAuth));
  await request("signed NoxHere session searches its organization", "/api/v1/search?q=allowed", signedOptions(sessionAuth));
  await request("signed NoxHere session reads members", "/api/v1/members", signedOptions(sessionAuth));
  await request("signed NoxHere session reads Slack health without receiving credentials", "/api/v1/slack/status", signedOptions(sessionAuth));
  await request("signed NoxHere admin reads its bound default prompt", "/api/v1/activity/release-notes-prompt", signedOptions(sessionAuth));
  await request("project-scoped NoxHere credential reads the service catalog", "/api/v1/services", signedOptions(projectAuth));
  const scopedFeed = await request("project credential reads only its own feed", "/api/v1/activity", signedOptions(projectAuth));
  if (scopedFeed.body?.events?.length !== 1 || scopedFeed.body.events[0]?.summary !== "allowed project event") {
    throw new Error("Project token crossed its feed project boundary");
  }
  await request("project credential cannot select another project", "/api/v1/activity", signedOptions(projectAuth, { headers: { "X-Project-ID": otherProjectId } }), 404);
  await request("project credential cannot read organization-level configuration", "/api/v1/services/activity/config", signedOptions(projectAuth), 403);
  await request("all project capabilities remain available", "/api/v1/activity", signedOptions(projectAuth));
  await request("configure project-scoped Telemetry GitHub incident routing", "/api/v1/telemetry/github-issues", signedOptions(sessionAuth, {
    method: "PUT",
    body: JSON.stringify({
      projectId, enabled: false, environments: ["production", "staging"],
      commentOnRepeat: false, repeatIntervalMinutes: 360,
    }),
  }));
  const incidentSettings = await request("read Telemetry GitHub incident routing", "/api/v1/telemetry/github-issues", signedOptions(sessionAuth));
  if (!incidentSettings.body?.projects?.some((project) => project.projectId === projectId
      && project.environments?.includes("staging"))) {
    throw new Error("Telemetry GitHub incident settings were not persisted");
  }
  const ownSource = await request("project credential creates a source in its implicit project", "/api/v1/telemetry/sources", signedOptions(projectAuth, {
    method: "POST",
    body: JSON.stringify({ name: "Token project", enabled: true, timezone: "UTC", digestEnabled: false, digestTimeLocal: "00:30", allowedOrigins: [], healthEnabled: false, healthUrl: null, slackChannelId: null, slackConnectionId: null }),
  }), 201);
  if (ownSource.body?.projectId !== projectId) throw new Error("Token-created source was not assigned to the token project");
  const ownSite = await request("project credential creates a site in its implicit project", "/api/v1/feedback/sites", signedOptions(projectAuth, {
    method: "POST", body: JSON.stringify({ name: "Token project", widgetMode: "development" }),
  }), 201);
  if (ownSite.body?.site?.projectId !== projectId) throw new Error("Token-created site was not assigned to the token project");
  const otherSource = await request("create another project's Telemetry source as a NoxHere admin", "/api/v1/telemetry/sources", signedOptions(sessionAuth, {
    method: "POST",
    body: JSON.stringify({ name: "Other project", projectId: otherProjectId, enabled: true, timezone: "UTC", digestEnabled: false, digestTimeLocal: "00:30", allowedOrigins: [], healthEnabled: false, healthUrl: null, slackChannelId: null, slackConnectionId: null }),
  }), 201);
  await request("project credential cannot read another project's source", `/api/v1/telemetry/sources/${otherSource.body.id}`, signedOptions(projectAuth), 404);
  await request("project credential cannot read another project's metrics", `/api/v1/telemetry/metrics?sourceId=${encodeURIComponent(otherSource.body.id)}&days=1`, signedOptions(projectAuth), 404);
  await request("project credential cannot create a source for another project", "/api/v1/telemetry/sources", signedOptions(projectAuth, {
    method: "POST",
    body: JSON.stringify({ name: "Cross-project source", projectId: otherProjectId, enabled: true, timezone: "UTC", digestEnabled: false, digestTimeLocal: "00:30", allowedOrigins: [], healthEnabled: false, healthUrl: null, slackChannelId: null, slackConnectionId: null }),
  }), 404);
  const scopedSources = await request("project credential lists only its own sources", "/api/v1/telemetry/sources", signedOptions(projectAuth));
  if (!scopedSources.body?.sources?.length || scopedSources.body.sources.some((source) => source.projectId !== projectId)) {
    throw new Error("Telemetry source collection crossed the token project boundary");
  }
  const otherSite = await request("create another project's Feedback site as a NoxHere admin", "/api/v1/feedback/sites", signedOptions(sessionAuth, {
    method: "POST", body: JSON.stringify({ name: "Other project", projectId: otherProjectId, widgetMode: "development" }),
  }), 201);
  await request("project credential cannot change another project's site", `/api/v1/feedback/sites/${otherSite.body.site.id}`, signedOptions(projectAuth, {
    method: "PATCH", body: JSON.stringify({ name: "Cross-project change" }),
  }), 404);
  await request("project credential cannot create a site for another project", "/api/v1/feedback/sites", signedOptions(projectAuth, {
    method: "POST", body: JSON.stringify({ name: "Cross-project site", projectId: otherProjectId, widgetMode: "development" }),
  }), 404);
  const scopedSites = await request("project credential lists only its own sites", "/api/v1/feedback/sites", signedOptions(projectAuth));
  if (!scopedSites.body?.sites?.length || scopedSites.body.sites.some((site) => site.projectId !== projectId)) {
    throw new Error("Feedback site collection crossed the token project boundary");
  }
  const catalog = await request("authenticated service catalog using a NoxHere session assertion", "/api/v1/services", signedOptions(sessionAuth));
  if (!Array.isArray(catalog.body?.services) || catalog.body.services.length !== 5) throw new Error("Expected all five service families");
  for (const service of ["noxhere", "planning", "activity", "feedback", "telemetry"]) {
    await request(`${service} setup contract`, `/api/v1/services/${service}/setup`, signedOptions(sessionAuth));
    await request(`${service} health contract`, `/api/v1/services/${service}/health`, signedOptions(sessionAuth));
    await request(`${service} config contract`, `/api/v1/services/${service}/config`, signedOptions(sessionAuth));
  }

  const currentConfig = await request("read versioned config and ETag", "/api/v1/services/noxhere/config", signedOptions(sessionAuth));
  const etag = currentConfig.response.headers.get("etag");
  if (!etag) throw new Error("Config response did not return ETag");
  await request("config write requires If-Match", "/api/v1/services/noxhere/config", signedOptions(sessionAuth, {
    method: "PATCH", body: JSON.stringify({ newRepositoryPolicy: "exclude" }),
  }), 428);
  await request("stale config write is rejected", "/api/v1/services/noxhere/config", signedOptions(sessionAuth, {
    method: "PATCH", headers: { "If-Match": '"stale"' }, body: JSON.stringify({ newRepositoryPolicy: "exclude" }),
  }), 412);
  const updated = await request("config compare-and-swap update", "/api/v1/services/noxhere/config", signedOptions(sessionAuth, {
    method: "PATCH", headers: { "If-Match": etag }, body: JSON.stringify({ newRepositoryPolicy: "exclude" }),
  }));
  await request("restore config after compare-and-swap check", "/api/v1/services/noxhere/config", signedOptions(sessionAuth, {
    method: "PATCH", headers: { "If-Match": updated.response.headers.get("etag") }, body: JSON.stringify({ newRepositoryPolicy: "include" }),
  }));

  const projects = await request("project discovery from local installation fixture", "/api/v1/projects", signedOptions(sessionAuth));
  if (!projects.body?.projects?.some((project) => project.id === projectId)) throw new Error("Fixture project was not returned");
  const legacyProjects = await request("compatibility project discovery remains available during migration", "/api/projects", signedOptions(sessionAuth));
  const canonicalProjectIds = projects.body.projects.map((project) => project.id).sort();
  const legacyProjectIds = legacyProjects.body?.projects?.map((project) => project.id).sort();
  if (JSON.stringify(canonicalProjectIds) !== JSON.stringify(legacyProjectIds)) {
    throw new Error("Canonical and legacy project discovery returned different resources");
  }

  const source = await request("create a Telemetry source through the control API", "/api/v1/telemetry/sources", signedOptions(sessionAuth, {
    method: "POST",
    body: JSON.stringify({ name: "Local E2E", projectId, enabled: true, timezone: "UTC", digestEnabled: false, digestTimeLocal: "00:30", allowedOrigins: [], healthEnabled: false, healthUrl: null, slackChannelId: null, slackConnectionId: null }),
  }), 201);
  const sourceId = source.body.id;
  const key = await request("create a one-time Telemetry ingest key", `/api/v1/telemetry/sources/${sourceId}/keys`, signedOptions(sessionAuth, {
    method: "POST", body: JSON.stringify({ name: "Local E2E", kind: "secret" }),
  }), 201);
  const keyId = key.body.key.id;
  const keyValue = key.body.key.value;
  const event = await request("ingest a real Telemetry event through the NoxHere binding", "/api/v1/telemetry/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": keyValue },
    body: JSON.stringify({ version: 1, type: "user.registered", userId: "h1_local-e2e_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40", idempotencyKey: "local-e2e-registration" }),
  }, 202);
  if (!event.body?.accepted || event.body?.stored !== true) throw new Error("Telemetry did not persist the event");
  const duplicate = await request("Telemetry ingestion is idempotent", "/api/v1/telemetry/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": keyValue },
    body: JSON.stringify({ version: 1, type: "user.registered", userId: "h1_local-e2e_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40", idempotencyKey: "local-e2e-registration" }),
  }, 202);
  if (duplicate.body?.duplicate !== true) throw new Error("Telemetry duplicate was not detected");
  const metrics = await request("read persisted Telemetry metrics", `/api/v1/telemetry/metrics?sourceId=${encodeURIComponent(sourceId)}&days=1`, signedOptions(sessionAuth));
  if (!Array.isArray(metrics.body?.days)) throw new Error("Telemetry metrics response is malformed");
  await request("revoke the Telemetry ingest key", `/api/v1/telemetry/sources/${sourceId}/keys/${keyId}`, signedOptions(sessionAuth, { method: "DELETE" }));
  await request("revoked Telemetry key is rejected", "/api/v1/telemetry/public/events", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": keyValue },
    body: JSON.stringify({ version: 1, type: "user.active", userId: "local-e2e-user" }),
  }, 401);

  const site = await request("create a Feedback site through the control API", "/api/v1/feedback/sites", signedOptions(sessionAuth, {
    method: "POST", body: JSON.stringify({ name: "Local E2E", projectId, widgetMode: "development", autoErrorLogging: true }),
  }), 201);
  const siteId = site.body.site.id;
  const publicConfig = await request("read Feedback public widget config", `http://127.0.0.1:${port(8790)}/api/feedback/public/v1/sites/${siteId}/config`);
  await request("read Feedback public widget members", `http://127.0.0.1:${port(8790)}/api/feedback/public/v1/sites/${siteId}/members`);
  if (publicConfig.body?.siteId !== siteId) throw new Error("Feedback config did not use the shared D1 state");
  const report = await request("queue a real Feedback public report", `http://127.0.0.1:${port(8790)}/api/feedback/public/v1/reports`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, title: "Local E2E feedback", description: "Disposable local queue smoke test" }),
  });
  if (!report.body?.queued) throw new Error("Feedback did not enqueue the report");

  const pingBody = JSON.stringify({ zen: "local e2e" });
  await request("reject an invalid GitHub webhook signature", "/api/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping", "X-GitHub-Delivery": "local-e2e-bad", "X-Hub-Signature-256": `sha256=${"0".repeat(64)}` }, body: pingBody,
  }, 401);
  const signature = `sha256=${createHmac("sha256", webhookSecret).update(pingBody).digest("hex")}`;
  const ping = await request("accept a correctly signed GitHub webhook", "/api/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping", "X-GitHub-Delivery": "local-e2e-good", "X-Hub-Signature-256": signature }, body: pingBody,
  });
  if (ping.body?.message !== "pong") throw new Error("Webhook ping did not return pong");

  print(`\nPASS: ${results.length} end-to-end checks completed.`);
  print("Provider delivery note: GitHub App installation calls, Slack delivery, and AI narration require disposable sandbox provider credentials and are intentionally not attempted with production credentials.");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    failed = true;
    await stopChildren();
    process.exit(130);
  });
}

try {
  await main();
} catch (error) {
  failed = true;
  process.stderr.write(`\nFAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  for (const { name, logPath } of children) {
    process.stderr.write(`\n--- ${name} (${logPath}) ---\n${tail(logPath)}\n`);
  }
  process.exitCode = 1;
} finally {
  await stopChildren();
  if (keepState || failed) {
    print(`Local state retained at ${stateRoot}`);
  } else {
    rmSync(stateRoot, { recursive: true, force: true });
    print(`Removed disposable local state ${stateRoot}`);
  }
}
