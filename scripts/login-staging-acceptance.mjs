#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platformServices } from "../config/platform-services.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const controlConfig = "services/gateway/wrangler.jsonc";
const coreConfig = "services/core-api/wrangler.jsonc";

function fail(message) {
  throw new Error(`Staging login acceptance failed: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function validateLoginAcceptanceConfig({ baseUrl, expectedSha }) {
  const errors = [];
  let url;
  try { url = new URL(baseUrl); } catch { errors.push("base URL must be absolute"); }
  const expected = new URL(platformServices.origins.staging);
  if (url && (url.protocol !== "https:" || url.origin !== expected.origin)) {
    errors.push(`base URL must be the declared staging origin ${expected.origin}`);
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) errors.push("expected SHA must be a full Git commit SHA");
  return errors;
}

function d1(config, database, sql) {
  const result = spawnSync("npx", [
    "wrangler", "d1", "execute", database,
    "--config", config,
    "--env", "staging",
    "--remote",
    "--command", sql,
    "--json",
  ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) fail(`D1 command failed for ${database}: ${result.stderr.trim() || `exit ${result.status}`}`);
  let payload;
  try { payload = JSON.parse(result.stdout); } catch { fail(`D1 returned invalid JSON for ${database}`); }
  const operation = payload?.[0];
  if (!operation?.success) fail(`D1 command was unsuccessful for ${database}`);
  return operation.results ?? [];
}

function loadFixtures() {
  return d1(coreConfig, "DB", `
    SELECT org.id AS org_id, org.github_login AS org_login,
           project.id AS project_id, project.name AS project_name,
           CASE WHEN routing.project_id IS NULL THEN 0 ELSE 1 END AS routing_exists,
           COALESCE(routing.enabled, 0) AS routing_enabled
      FROM orgs org
      JOIN projects project ON project.org_id = org.id
      LEFT JOIN project_routing_settings routing
        ON routing.org_id = org.id AND routing.project_id = project.id
     WHERE project.archived = 0
     ORDER BY lower(org.github_login), lower(project.name)
  `).filter((row, index, rows) => rows.findIndex((candidate) => candidate.org_login.toLowerCase() === row.org_login.toLowerCase()) === index);
}

function createProvisioningIdentity(runId) {
  const principalId = `acceptance:${runId}`;
  const sessionId = `acceptance-session:${runId}`;
  const tokenId = `acceptance-token:${runId}`;
  const login = `nox-acceptance-${runId.slice(0, 12)}`;
  return {
    principalId,
    sessionId,
    tokenId,
    login,
    githubUserId: -Number(String(Date.now()).slice(-12)),
    accessToken: `nox_at_test_${randomBytes(24).toString("hex")}`,
    refreshToken: `nox_rt_test_${randomBytes(24).toString("hex")}`,
    apiToken: `nox_sk_test_${randomBytes(24).toString("hex")}`,
  };
}

function provision(fixture, identity) {
  const now = new Date().toISOString();
  const accessExpiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const { principalId, sessionId, tokenId, login, githubUserId, accessToken, refreshToken, apiToken } = identity;

  const routingSql = fixture.map((item) => `
    INSERT INTO project_routing_settings (org_id, project_id, enabled, updated_at)
    VALUES (${sqlValue(item.org_id)}, ${sqlValue(item.project_id)}, 1, ${sqlValue(now)})
    ON CONFLICT(org_id, project_id) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at
  `).join(";");
  d1(coreConfig, "DB", routingSql);

  const organizationSql = fixture.map((item) => `
    INSERT OR IGNORE INTO orgs (id, github_login) VALUES (${sqlValue(item.org_id)}, ${sqlValue(item.org_login)});
    INSERT INTO projects (id, org_id, name, slug, archived, enabled, updated_at)
    VALUES (${sqlValue(item.project_id)}, (SELECT id FROM orgs WHERE github_login = ${sqlValue(item.org_login)} COLLATE NOCASE),
            ${sqlValue(item.project_name)}, ${sqlValue(item.project_id)}, 0, 1, ${sqlValue(now)})
    ON CONFLICT(id) DO UPDATE SET org_id = excluded.org_id, name = excluded.name,
      archived = 0, enabled = 1, updated_at = excluded.updated_at
  `).join(";");
  const membershipSql = fixture.map((item) => `
    INSERT INTO org_memberships (org_id, principal_id, role, managed_role, verified_at)
    VALUES ((SELECT id FROM orgs WHERE github_login = ${sqlValue(item.org_login)} COLLATE NOCASE),
            ${sqlValue(principalId)}, 'admin', NULL, ${sqlValue(now)})
    ON CONFLICT(org_id, principal_id) DO UPDATE SET role = 'admin', managed_role = NULL, verified_at = excluded.verified_at
  `).join(";");
  d1(controlConfig, "CONTROL_DB", `
    ${organizationSql};
    INSERT INTO principals (id, github_user_id, github_login, avatar_url, created_at, updated_at)
    VALUES (${sqlValue(principalId)}, ${sqlValue(githubUserId)}, ${sqlValue(login)}, NULL, ${sqlValue(now)}, ${sqlValue(now)});
    ${membershipSql};
    INSERT INTO native_sessions
      (id, principal_id, connection_id, client_name, access_token_hash, refresh_token_hash,
       access_expires_at, refresh_expires_at, created_at, last_used_at)
    VALUES (${sqlValue(sessionId)}, ${sqlValue(principalId)}, NULL, 'staging-acceptance',
            ${sqlValue(sha256(accessToken))}, ${sqlValue(sha256(refreshToken))},
            ${sqlValue(accessExpiresAt)}, ${sqlValue(refreshExpiresAt)}, ${sqlValue(now)}, ${sqlValue(now)});
    INSERT INTO api_tokens
      (id, org_id, project_id, name, environment, token_prefix, token_hash, scopes_json, created_by, created_at, expires_at)
    VALUES (${sqlValue(tokenId)},
            (SELECT id FROM orgs WHERE github_login = ${sqlValue(fixture[0].org_login)} COLLATE NOCASE),
            ${sqlValue(fixture[0].project_id)}, 'staging login acceptance', 'staging', 'nox_sk_test_',
            ${sqlValue(sha256(apiToken))}, '["services:read"]', ${sqlValue(login)}, ${sqlValue(now)}, ${sqlValue(accessExpiresAt)});
  `);
}

function cleanup(fixture, provisioned) {
  if (provisioned) {
    d1(controlConfig, "CONTROL_DB", `
      DELETE FROM api_tokens WHERE id = ${sqlValue(provisioned.tokenId)};
      DELETE FROM native_sessions WHERE id = ${sqlValue(provisioned.sessionId)};
      DELETE FROM org_memberships WHERE principal_id = ${sqlValue(provisioned.principalId)};
      DELETE FROM principals WHERE id = ${sqlValue(provisioned.principalId)};
    `);
  }
  for (const item of fixture) {
    if (item.routing_exists) {
      d1(coreConfig, "DB", `
        UPDATE project_routing_settings SET enabled = ${sqlValue(item.routing_enabled)},
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE org_id = ${sqlValue(item.org_id)} AND project_id = ${sqlValue(item.project_id)}
      `);
    } else {
      d1(coreConfig, "DB", `
        DELETE FROM project_routing_settings
        WHERE org_id = ${sqlValue(item.org_id)} AND project_id = ${sqlValue(item.project_id)}
      `);
    }
  }
}

async function jsonRequest(baseUrl, path, { token, org, projectId, expected = [200] } = {}) {
  const headers = new Headers({ Accept: "application/json", "Cache-Control": "no-cache" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (org) headers.set("X-Org", org);
  if (projectId) headers.set("X-Project-ID", projectId);
  const response = await fetch(new URL(path, baseUrl), { headers });
  const body = await response.json().catch(() => null);
  if (!expected.includes(response.status)) {
    fail(`${path} returned ${response.status}, expected ${expected.join("/")}: ${JSON.stringify(body)}`);
  }
  return { response, body };
}

export function assertBootstrapScope(body, fixture, { exactProject = false } = {}) {
  if (body?.organization?.id?.toLowerCase() !== fixture.org_login.toLowerCase()) {
    fail(`bootstrap organization mismatch for ${fixture.org_login}`);
  }
  const projectIds = body?.projects?.map((project) => project.id) ?? [];
  if (!projectIds.includes(fixture.project_id)) fail(`bootstrap omitted project ${fixture.project_id}`);
  if (exactProject && (projectIds.length !== 1 || projectIds[0] !== fixture.project_id)) {
    fail(`automation bootstrap escaped project ${fixture.project_id}`);
  }
}

export async function runLoginStagingAcceptance({
  baseUrl = process.env.NOX_LOGIN_ACCEPTANCE_BASE_URL ?? platformServices.origins.staging,
  expectedSha = process.env.NOX_LOGIN_ACCEPTANCE_EXPECTED_SHA ?? process.env.DEPLOY_SHA ?? "",
} = {}) {
  const errors = validateLoginAcceptanceConfig({ baseUrl, expectedSha });
  if (errors.length) fail(errors.join("; "));
  const fixtures = loadFixtures();
  if (fixtures.length < 2) fail("two distinct staging organizations with projects are required");
  const selected = fixtures.slice(0, 2);
  const runId = randomUUID();
  const provisioned = createProvisioningIdentity(runId);
  try {
    provision(selected, provisioned);
    const readiness = await jsonRequest(baseUrl, "/api/health/ready");
    if (readiness.body?.versions?.noxhere !== expectedSha) fail("staging gateway is not the expected release");

    const unauthenticated = await jsonRequest(baseUrl, "/api/v1/bootstrap", { expected: [401] });
    if (unauthenticated.body?.error?.code !== "unauthorized") fail("bootstrap did not fail with canonical unauthorized JSON");

    const profile = (await jsonRequest(baseUrl, "/api/v1/auth/profile", { token: provisioned.accessToken })).body;
    for (const fixture of selected) {
      if (!profile?.orgs?.some((org) => org.login.toLowerCase() === fixture.org_login.toLowerCase())) {
        fail(`native login profile omitted organization ${fixture.org_login}`);
      }
      const bootstrap = (await jsonRequest(baseUrl, "/api/v1/bootstrap", {
        token: provisioned.accessToken,
        org: fixture.org_login,
        projectId: fixture.project_id,
      })).body;
      assertBootstrapScope(bootstrap, fixture);
    }

    const tokenBootstrap = (await jsonRequest(baseUrl, "/api/v1/bootstrap", {
      token: provisioned.apiToken,
      org: selected[0].org_login,
      projectId: selected[0].project_id,
    })).body;
    assertBootstrapScope(tokenBootstrap, selected[0], { exactProject: true });
    await jsonRequest(baseUrl, "/api/v1/bootstrap", {
      token: provisioned.apiToken,
      org: selected[1].org_login,
      projectId: selected[0].project_id,
      expected: [403],
    });
    await jsonRequest(baseUrl, "/api/v1/bootstrap", {
      token: provisioned.apiToken,
      org: selected[0].org_login,
      projectId: selected[1].project_id,
      expected: [404],
    });

    process.stdout.write(`${JSON.stringify({ status: "ready", buildSha: expectedSha, organizations: selected.map((item) => item.org_login), checks: ["unauthenticated-boundary", "native-login", "organization-switch", "bootstrap-scope", "api-token-scope"] })}\n`);
  } finally {
    cleanup(selected, provisioned);
  }
}

export function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === "--contract") {
    const rendered = JSON.stringify(platformServices.gateway.routeGroups);
    if (!rendered.includes("/api/v1/auth") && !rendered.includes("/api/v1/bootstrap")) {
      // Authenticated routes intentionally flow through the default private API
      // boundary, so they must never appear in a public route group.
      process.stdout.write("Staging login acceptance contract is configured for private auth/bootstrap routing.\n");
      return;
    }
    fail("login or bootstrap route was accidentally made public");
  }
  if (args.length) throw new Error("Usage: node scripts/login-staging-acceptance.mjs [--contract]");
  return runLoginStagingAcceptance();
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
