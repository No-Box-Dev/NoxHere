import { spawnSync } from "node:child_process";

const runner = process.platform === "win32" ? "npx.cmd" : "npx";
const projectId = "proj_no-box-dev_playnist";
const orgId = 2;
const ownerId = "No-Box-Dev";
const repository = "playnist";
const pageSize = 1000;

// Deliberate allow-list: credentials, tokens, OAuth state, encrypted reporter
// details, connection secrets, and delivery queues never leave production.
const tables = [
  { table: "gh_repos", where: `full_name = '${ownerId}/${repository}'` },
  { table: "gh_users", where: `id IN (SELECT gh_user_id FROM gh_members WHERE installation_id = (SELECT installation_id FROM orgs WHERE id = ${orgId}))` },
  { table: "gh_members", where: `installation_id = (SELECT installation_id FROM orgs WHERE id = ${orgId})` },
  { table: "actors", where: `owner_id = '${ownerId}'` },
  { table: "actor_repo_notes", where: `project_id = '${projectId}'` },
  { table: "pull_requests", where: `project_id = '${projectId}'` },
  { table: "issues", where: `project_id = '${projectId}'` },
  {
    table: "events",
    where: `project_id = '${projectId}' AND type IN ('pr_narrative','narrative','release_notes','spot:issue_created','stats.daily')`,
  },
  { table: "features", where: `project_id = '${projectId}'` },
  { table: "spec_folders", where: `id IN (SELECT folder_id FROM specs WHERE project_id = '${projectId}' AND folder_id IS NOT NULL)` },
  { table: "specs", where: `project_id = '${projectId}'` },
  { table: "spec_attachments", where: `project_id = '${projectId}'` },
  { table: "pr_feature_links", where: `pr_repo = '${repository}'` },
  { table: "github_commits", where: `project_id = '${projectId}'` },
  { table: "spot_sites", where: `project_id = '${projectId}'` },
  {
    table: "spot_reports",
    where: `project_id = '${projectId}'`,
    columns: [
      "id", "org_id", "project_id", "site_id", "repo", "issue_number", "issue_url", "title",
      "reporter_name", "notification_consent", "status", "resolution_summary", "resolved_at", "resolved_by",
      "resolution_source", "notification_status", "notification_attempts", "notification_last_error",
      "last_notified_at", "created_at", "updated_at",
    ],
  },
  { table: "spot_report_activity", where: `report_id IN (SELECT id FROM spot_reports WHERE project_id = '${projectId}')` },
  { table: "noxspot_config_audit", where: `project_id = '${projectId}'` },
  {
    table: "cue_sources",
    where: `project_id = '${projectId}'`,
    columns: [
      "id", "org_id", "owner_id", "project_id", "name", "enabled", "allowed_origins_json",
      "created_by", "created_at", "updated_at", "timezone", "digest_enabled", "digest_time_local",
      "error_cooldown_minutes", "environment", "alerts_enabled",
    ],
  },
  { table: "cue_daily_metrics", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_error_groups", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_error_daily_groups", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_user_registrations", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_user_active_days", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_feature_results", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_feature_states", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_endpoint_monitors", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_custom_features", where: `project_id = '${projectId}' OR source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_custom_metrics", where: `project_id = '${projectId}' OR source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_activity_events", where: `source_id IN (SELECT id FROM cue_sources WHERE project_id = '${projectId}')` },
  { table: "cue_project_metric_settings", where: `project_id = '${projectId}'` },
  { table: "cue_github_issue_settings", where: `project_id = '${projectId}'` },
  { table: "cue_github_incidents", where: `project_id = '${projectId}'` },
  { table: "cue_github_issue_links", where: `incident_id IN (SELECT id FROM cue_github_incidents WHERE project_id = '${projectId}')` },
  { table: "members", where: `org_id = ${orgId}` },
];

function executeRemote(command) {
  const result = spawnSync(
    runner,
    ["wrangler", "d1", "execute", "noxconnect", "--remote", "--command", command, "--json"],
    { cwd: process.cwd(), encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    const failure = `${result.stderr}\n${result.stdout}`;
    if (failure.includes("no such table")) return null;
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout)[0]?.results ?? [];
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const fromTable = process.argv.find((argument) => argument.startsWith("--from="))?.slice("--from=".length);
const fromIndex = fromTable ? tables.findIndex((entry) => entry.table === fromTable) : 0;
if (fromTable && fromIndex < 0) throw new Error(`Unknown mirror table: ${fromTable}`);
const selectedTables = tables.slice(Math.max(0, fromIndex));

const mirrored = [];
for (const entry of selectedTables) {
  const rows = [];
  const projection = entry.columns?.map(identifier).join(", ") ?? "*";
  for (let offset = 0; ; offset += pageSize) {
    const page = executeRemote(
      `SELECT ${projection} FROM ${identifier(entry.table)} WHERE ${entry.where} ORDER BY rowid LIMIT ${pageSize} OFFSET ${offset}`,
    );
    if (page === null) {
      console.log(`${entry.table}: unavailable in production schema, skipped`);
      rows.length = 0;
      break;
    }
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  if (rows.length === 0) {
    const probe = executeRemote(`SELECT 1 AS present FROM ${identifier(entry.table)} LIMIT 1`);
    if (probe === null) continue;
  }
  mirrored.push({ ...entry, rows });
  console.log(`${entry.table}: ${rows.length}`);
}

// The D1 issue cache historically omitted GitHub bodies. NoxSpot's real
// description, screenshot URL and capture context live in that body, so enrich
// the local mirror from the authenticated GitHub CLI when it is available.
const issueMirror = mirrored.find((entry) => entry.table === "issues");
if (issueMirror?.rows.length) {
  const github = spawnSync(
    "gh",
    ["api", "--method", "GET", "--paginate", "--slurp", `repos/${ownerId}/${repository}/issues`,
      "-f", "state=all", "-f", "labels=noxspot", "-f", "per_page=100"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (github.status === 0) {
    const bodies = new Map(JSON.parse(github.stdout).flat()
      .filter((issue) => !issue.pull_request)
      .map((issue) => [Number(issue.number), issue.body ?? null]));
    for (const row of issueMirror.rows) {
      if (bodies.has(Number(row.number))) row.body = bodies.get(Number(row.number));
    }
    console.log(`issues: enriched ${bodies.size} NoxSpot bodies from GitHub`);
  } else {
    console.warn("issues: GitHub CLI unavailable; NoxSpot body enrichment skipped");
  }
}

const statements = [];
for (const entry of [...mirrored].reverse()) {
  statements.push(`DELETE FROM ${identifier(entry.table)} WHERE ${entry.where}`);
}
for (const entry of mirrored) {
  for (const row of entry.rows) {
    const columns = Object.keys(row);
    statements.push(
      `INSERT OR REPLACE INTO ${identifier(entry.table)} (${columns.map(identifier).join(", ")}) VALUES (${columns.map((column) => sqlValue(row[column])).join(", ")})`,
    );
  }
}

function executeLocal(batch) {
  const local = spawnSync(
    runner,
    ["wrangler", "d1", "execute", "noxconnect", "--local", "--command", batch],
    { cwd: process.cwd(), env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (local.status !== 0) {
    process.stderr.write(local.stderr || local.stdout);
    process.exit(local.status ?? 1);
  }
}

let batch = "";
for (const statement of statements) {
  const next = `${statement};\n`;
  if (batch && batch.length + next.length > 350_000) {
    executeLocal(batch);
    batch = "";
  }
  batch += next;
}
if (batch) executeLocal(batch);

const total = mirrored.reduce((sum, entry) => sum + entry.rows.length, 0);
console.log(`Mirrored ${total} safe Playnist records into local NoxConnect. Production was read-only.`);
