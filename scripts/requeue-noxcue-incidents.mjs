import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const environmentIndex = args.indexOf("--env");
const environment = environmentIndex >= 0 ? args[environmentIndex + 1] : "production";
const ids = args.filter((value, index) => value !== "--apply" && value !== "--env" && index !== environmentIndex + 1);

if (!["production", "staging"].includes(environment) || ids.length === 0 || ids.length > 50
  || ids.some((id) => !/^[A-Za-z0-9_-]{1,100}$/.test(id))) {
  console.error("Usage: node scripts/requeue-noxcue-incidents.mjs [--env production|staging] [--apply] <incident-id> [...]");
  process.exit(2);
}

const quotedIds = ids.map((id) => `'${id}'`).join(", ");
const selectSql = `SELECT id, status, last_error, occurrence_count, last_seen_at
FROM cue_github_incidents
WHERE id IN (${quotedIds})
ORDER BY id`;

function wrangler(sql) {
  const wranglerArgs = [
    "--no-install", "wrangler", "d1", "execute", "DB",
    "--config", "workers/api-gateway/wrangler.jsonc",
    "--remote",
    ...(environment === "staging" ? ["--env", "staging"] : []),
    "--command", sql,
  ];
  const result = spawnSync("npx", wranglerArgs, { cwd: process.cwd(), stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Previewing ${ids.length} NoxCue incident(s) in ${environment}.`);
wrangler(selectSql);

if (!apply) {
  console.log("Preview only. Re-run with --apply to requeue only quarantined rows.");
  process.exit(0);
}

const updateSql = `UPDATE cue_github_incidents
SET status = 'pending', last_error = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE id IN (${quotedIds})
  AND status = 'disabled'
  AND last_error = 'quarantined_pre_rpc_repair';`;
wrangler(updateSql);
wrangler(selectSql);
