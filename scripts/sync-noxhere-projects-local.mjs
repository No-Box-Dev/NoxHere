import { spawnSync } from "node:child_process";

const runner = process.platform === "win32" ? "npx.cmd" : "npx";

// Which production org to mirror. Defaults to 2 (No-Box-Dev); pass another id to
// pull a different one, e.g. `node scripts/sync-noxhere-projects-local.mjs 1` for
// n1. Every org-scoped value below derives from this single input.
const orgId = Number(process.argv[2] ?? process.env.NOX_SYNC_ORG_ID ?? 2);
if (!Number.isInteger(orgId) || orgId <= 0) {
  throw new Error(`Expected a positive integer org id, received ${JSON.stringify(process.argv[2] ?? process.env.NOX_SYNC_ORG_ID)}`);
}

// Read-only against production. Nothing in this script writes to the remote D1.
function readRemote(command) {
  const remote = spawnSync(runner, ["wrangler", "d1", "execute", "noxconnect", "--remote", "--command", command, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  if (remote.status !== 0) {
    process.stderr.write(remote.stderr || remote.stdout);
    process.exit(remote.status ?? 1);
  }
  return JSON.parse(remote.stdout);
}

const q = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;

const orgResult = readRemote(`SELECT id, github_login, installation_id FROM orgs WHERE id = ${orgId};`);
const org = orgResult[0]?.results?.[0];
if (!org) throw new Error(`Production has no org with id ${orgId}`);

// The installation is keyed by the org's GitHub login, so read it from the org row
// rather than restating it here.
const rest = readRemote([
  `SELECT installation_id, owner_id, account_login, account_type FROM installations WHERE owner_id = ${q(org.github_login)} LIMIT 1;`,
  `SELECT id, name, slug, org, repo, description, narrator_enabled, owner_id, org_id, archived, archived_at, updated_at FROM projects WHERE org_id = ${orgId} AND archived = 0 ORDER BY name;`,
].join(" "));
const installation = rest[0]?.results?.[0];
const projects = rest[1]?.results ?? [];
if (!installation || projects.length === 0) {
  throw new Error(`The production project catalog returned no usable records for ${org.github_login} (org ${orgId})`);
}
const repoNames = projects.map((project) => `${project.org}/${project.repo}`);
const statements = [
  "DELETE FROM specs WHERE project_id = 'test-project'",
  "DELETE FROM features WHERE project_id = 'test-project'",
  "DELETE FROM project_config WHERE project_id = 'test-project'",
  "DELETE FROM project_routing_settings WHERE project_id = 'test-project'",
  "DELETE FROM project_repositories WHERE project_id = 'test-project'",
  "DELETE FROM projects WHERE id = 'test-project'",
  "DELETE FROM repos WHERE org_id = 910004",
  "DELETE FROM gh_members WHERE installation_id = 910004",
  "DELETE FROM installations WHERE installation_id = 910004",
  "DELETE FROM orgs WHERE id = 910004",
  `INSERT INTO orgs (id, github_login, installation_id) VALUES (${Number(org.id)}, ${q(org.github_login)}, ${Number(org.installation_id)}) ON CONFLICT(id) DO UPDATE SET github_login=excluded.github_login, installation_id=excluded.installation_id`,
  `INSERT INTO installations (installation_id, owner_id, account_login, account_type, repos_json, updated_at, health_status) VALUES (${Number(installation.installation_id)}, ${q(installation.owner_id)}, ${q(installation.account_login)}, ${q(installation.account_type)}, ${q(JSON.stringify(repoNames))}, unixepoch(), 'healthy') ON CONFLICT(installation_id) DO UPDATE SET owner_id=excluded.owner_id, account_login=excluded.account_login, account_type=excluded.account_type, repos_json=excluded.repos_json, updated_at=excluded.updated_at`,
];

for (const project of projects) {
  statements.push(
    `INSERT INTO projects (id,name,slug,org,repo,description,narrator_enabled,owner_id,org_id,archived,archived_at,updated_at) VALUES (${q(project.id)},${q(project.name)},${q(project.slug)},${q(project.org)},${q(project.repo)},${q(project.description)},${Number(project.narrator_enabled ?? 1)},${q(project.owner_id)},${orgId},0,NULL,${q(project.updated_at)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,org=excluded.org,repo=excluded.repo,description=excluded.description,narrator_enabled=excluded.narrator_enabled,owner_id=excluded.owner_id,org_id=${orgId},archived=0,archived_at=NULL,updated_at=excluded.updated_at`,
    `INSERT INTO project_routing_settings (org_id,project_id,enabled,updated_at) VALUES (${orgId},${q(project.id)},1,CURRENT_TIMESTAMP) ON CONFLICT(org_id,project_id) DO UPDATE SET enabled=1,updated_at=CURRENT_TIMESTAMP`,
    `INSERT INTO project_repositories (org_id,repo,project_id,updated_at) VALUES (${orgId},${q(project.repo)},${q(project.id)},CURRENT_TIMESTAMP) ON CONFLICT(org_id,repo) DO UPDATE SET project_id=excluded.project_id,updated_at=CURRENT_TIMESTAMP`,
    `INSERT INTO repos (org_id,name,discovered_at,acknowledged_at) VALUES (${orgId},${q(project.repo)},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(org_id,name) DO UPDATE SET acknowledged_at=CURRENT_TIMESTAMP`,
  );
}

const local = spawnSync(runner, ["wrangler", "d1", "execute", "noxconnect", "--local", "--command", statements.join(";"), "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  env: process.env,
});
if (local.status !== 0) {
  process.stderr.write(local.stderr || local.stdout);
  process.exit(local.status ?? 1);
}
console.log(`Mirrored ${projects.length} active ${org.github_login} projects (org ${orgId}) into local NoxConnect.`);
