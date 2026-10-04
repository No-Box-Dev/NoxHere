#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TYPES = new Set([
  "source_control.pull_request.opened", "source_control.pull_request.merged", "source_control.issue.created",
  "feedback.report.created", "feedback.report.reopened", "feedback.report.resolved",
  "reliability.error.detected", "reliability.incident.opened", "reliability.incident.resolved",
  "engagement.user.registered", "engagement.user.active", "engagement.activity.recorded",
  "capability.execution.completed", "delivery.notification.queued", "delivery.notification.delivered",
  "delivery.notification.failed",
]);

export function parseReplayArgs(argv) {
  const value = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };
  const projectId = value("--project-id");
  if (!projectId || !/^[A-Za-z0-9_.:-]{1,160}$/.test(projectId)) throw new Error("--project-id is required");
  const orgId = Number(value("--org-id"));
  if (!Number.isInteger(orgId) || orgId <= 0) throw new Error("--org-id must be a positive integer");
  const types = (value("--types") ?? "").split(",").filter(Boolean);
  if (types.some((type) => !TYPES.has(type))) throw new Error("--types contains an unknown platform event type");
  const from = value("--from");
  const to = value("--to");
  if (from && !Number.isFinite(Date.parse(from))) throw new Error("--from must be an ISO timestamp");
  if (to && !Number.isFinite(Date.parse(to))) throw new Error("--to must be an ISO timestamp");
  const limit = Number(value("--limit") ?? 1000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error("--limit must be between 1 and 5000");
  const execute = argv.includes("--execute");
  const remote = argv.includes("--remote");
  if (execute && !remote && !argv.includes("--local")) throw new Error("Execution requires exactly one of --local or --remote");
  if (remote && argv.includes("--local")) throw new Error("Choose only one of --local or --remote");
  return { projectId, orgId, types, from, to, limit, execute, remote };
}

function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }

export function replaySql(options) {
  const filters = [`org_id = ${options.orgId}`, `project_id = ${quote(options.projectId)}`];
  if (options.types.length) filters.push(`type IN (${options.types.map(quote).join(", ")})`);
  if (options.from) filters.push(`occurred_at >= ${quote(new Date(options.from).toISOString())}`);
  if (options.to) filters.push(`occurred_at <= ${quote(new Date(options.to).toISOString())}`);
  return `UPDATE platform_events SET projection_status = 'pending', projected_at = NULL, last_error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id IN (SELECT id FROM platform_events WHERE ${filters.join(" AND ")} ORDER BY occurred_at, id LIMIT ${options.limit});`;
}

export function runReplay(argv, spawn = spawnSync) {
  const options = parseReplayArgs(argv);
  const sql = replaySql(options);
  if (!options.execute) return { dryRun: true, sql };
  const args = ["wrangler", "d1", "execute", "DB", options.remote ? "--remote" : "--local", "--config", "workers/api-gateway/wrangler.jsonc", "--env=", "--command", sql];
  const result = spawn("npx", args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Replay command failed with status ${result.status}`);
  return { dryRun: false, sql };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runReplay(process.argv.slice(2));
    if (result.dryRun) console.log(result.sql);
    else console.log("Platform events reset to pending; the projection recovery sweep will enqueue them.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
