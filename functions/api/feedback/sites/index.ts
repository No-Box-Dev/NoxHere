import { z } from "zod";
import { getCtx, jsonResponse, errorResponse } from "../../../lib/db";
import { validate } from "../../../lib/validate";
import { getNoxDb, type NoxDatabaseEnv } from "../../../lib/nox-db";
import { feedbackAuditStatement } from "../../../lib/feedback-audit";
import {
  FEEDBACK_LAUNCHER_POSITIONS,
  FEEDBACK_LAUNCHER_STYLES,
  normalizeFeedbackLauncher,
} from "../../../../packages/contracts/feedback-launcher";

interface Ctx {
  env: NoxDatabaseEnv;
  data: { orgId: number; orgLogin: string; userLogin: string; isAdmin: boolean; projectId?: string | null };
  request: Request;
}

const LauncherViewportInput = z.object({
  style: z.enum(FEEDBACK_LAUNCHER_STYLES),
  position: z.enum(FEEDBACK_LAUNCHER_POSITIONS),
});

const LauncherInput = z.object({
  desktop: LauncherViewportInput,
  mobile: LauncherViewportInput,
});

const CreateSite = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  projectId: z.string().trim().min(1, "Project is required").max(240).optional(),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid button color").optional(),
  buttonText: z.string().trim().min(1).max(40).optional(),
  widgetMode: z.enum(["development", "release"]).optional(),
  autoErrorLogging: z.boolean().optional(),
  launcher: LauncherInput.optional(),
});

const SITE_SELECT = `
  site.id, site.name, site.project_id, site.repo, site.widget_config,
  site.slack_channel_id, site.slack_connection_id, site.created_at, site.updated_at,
  (SELECT project.repo FROM projects project WHERE project.id = site.project_id
    AND project.org_id = site.org_id AND COALESCE(project.archived, 0) = 0) AS project_delivery_repo,
  EXISTS(SELECT 1 FROM orgs org WHERE org.id = site.org_id AND org.installation_id IS NOT NULL) AS github_connected`;

function siteDto(row: Record<string, unknown>) {
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(String(row.widget_config || "{}")); } catch { /* defaults below */ }
  const pendingCount = Number(row.slack_pending_count ?? 0);
  const blockedCount = Number(row.slack_blocked_count ?? 0);
  const failedCount = Number(row.slack_failed_count ?? 0);
  const githubPendingCount = Number(row.github_pending_count ?? 0);
  const githubBlockedCount = Number(row.github_blocked_count ?? 0);
  const effectiveSlackChannelId = row.slack_channel_id || row.slack_fallback_channel_id;
  const lifecycle = config.lifecycle === "draft" || config.lifecycle === "disabled" ? config.lifecycle : "ready";
  const deliveryIssues: string[] = [];
  if (lifecycle !== "ready") deliveryIssues.push(`site_${lifecycle}`);
  if (!row.project_id || !row.project_delivery_repo) deliveryIssues.push("project_unavailable");
  else if (String(row.project_delivery_repo).toLowerCase() !== String(row.repo).toLowerCase()) deliveryIssues.push("repository_mismatch");
  if (!row.github_connected) deliveryIssues.push("github_not_connected");
  if (githubBlockedCount > 0) deliveryIssues.push("github_delivery_degraded");
  if (!Array.isArray(config.environments) || !config.environments.some((environment) => {
    const item = environment as { enabled?: unknown; url?: unknown };
    return item?.enabled !== false && typeof item?.url === "string" && item.url.trim();
  })) deliveryIssues.push("origin_not_configured");
  if (!effectiveSlackChannelId) deliveryIssues.push("slack_channel_not_configured");
  if (!row.slack_connected) deliveryIssues.push("slack_not_connected");
  const slackHealth = !effectiveSlackChannelId ? "disabled"
    : !row.slack_connected ? "disconnected"
      : row.slack_install_health === "degraded" || blockedCount > 0 || failedCount > 0 ? "degraded"
        : pendingCount > 0 || row.slack_install_health !== "ok" ? "pending" : "connected";
  if (slackHealth === "degraded") deliveryIssues.push("slack_delivery_degraded");
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    repo: row.repo,
    buttonColor: config.buttonColor ?? "#FE795D",
    buttonText: config.buttonText ?? "Report issue",
    widgetMode: config.widgetMode === "release" ? "release" : "development",
    autoErrorLogging: config.autoErrorLogging === true,
    lifecycle,
    deliveryReady: deliveryIssues.length === 0,
    deliveryIssues,
    launcher: normalizeFeedbackLauncher(config.launcher),
    environments: Array.isArray(config.environments) ? config.environments : [],
    blocks: Array.isArray(config.blocks) ? config.blocks : [],
    slackChannelId: row.slack_channel_id,
    slackConnectionId: row.slack_connection_id ?? null,
    slackEffectiveChannelId: effectiveSlackChannelId ?? null,
    slackUsesFallback: Boolean(!row.slack_channel_id && row.slack_fallback_channel_id),
    slackHealth,
    slackLastDeliveredAt: row.slack_last_delivered_at ?? null,
    slackPendingCount: pendingCount,
    slackBlockedCount: blockedCount + failedCount,
    slackLastError: row.slack_last_error ?? null,
    githubPendingCount,
    githubBlockedCount,
    githubLastError: row.github_last_error ?? null,
    dailySummaryEnabled: config.dailySummaryEnabled !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  const db = getNoxDb(context.env);

  const { results } = await db.prepare(
    `SELECT ${SITE_SELECT},
            (SELECT COUNT(*) FROM issues issue
              WHERE issue.org_id = site.org_id AND issue.repo = site.repo
                AND EXISTS (SELECT 1 FROM json_each(issue.labels_json)
                             WHERE json_extract(value, '$.name') = 'feedback')) AS issue_count,
            (SELECT COUNT(*) FROM issues issue
              WHERE issue.org_id = site.org_id AND issue.repo = site.repo AND issue.state = 'open'
                AND EXISTS (SELECT 1 FROM json_each(issue.labels_json)
                             WHERE json_extract(value, '$.name') = 'feedback')) AS open_issue_count,
            EXISTS(SELECT 1 FROM slack_connections slack WHERE slack.org_id = site.org_id
              AND slack.id = COALESCE(site.slack_connection_id,
                (SELECT json_extract(config.data, '$.slack.fallbackConnectionId') FROM config
                  WHERE config.org_id = site.org_id AND config.key = 'settings'),
                (SELECT id FROM slack_connections default_slack WHERE default_slack.org_id = site.org_id
                  ORDER BY is_default DESC, installed_at LIMIT 1))) AS slack_connected,
            (SELECT slack.health_status FROM slack_connections slack WHERE slack.org_id = site.org_id
              AND slack.id = COALESCE(site.slack_connection_id,
                (SELECT json_extract(config.data, '$.slack.fallbackConnectionId') FROM config
                  WHERE config.org_id = site.org_id AND config.key = 'settings'),
                (SELECT id FROM slack_connections default_slack WHERE default_slack.org_id = site.org_id
                  ORDER BY is_default DESC, installed_at LIMIT 1))) AS slack_install_health,
            (SELECT json_extract(config.data, '$.slack.fallbackChannelId') FROM config
              WHERE config.org_id = site.org_id AND config.key = 'settings') AS slack_fallback_channel_id,
            (SELECT json_extract(config.data, '$.slack.fallbackConnectionId') FROM config
              WHERE config.org_id = site.org_id AND config.key = 'settings') AS slack_fallback_connection_id,
            (SELECT COUNT(*) FROM transport_outbox delivery
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'slack'
                AND delivery.operation = 'slack.message.send' AND delivery.route = 'feedback'
                AND json_extract(delivery.command_json, '$.routeContext.kind') = 'site'
                AND json_extract(delivery.command_json, '$.routeContext.id') = site.id
                AND delivery.status IN ('pending', 'queued', 'processing', 'retrying')) AS slack_pending_count,
            (SELECT COUNT(*) FROM transport_outbox delivery
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'slack'
                AND delivery.operation = 'slack.message.send' AND delivery.route = 'feedback'
                AND json_extract(delivery.command_json, '$.routeContext.kind') = 'site'
                AND json_extract(delivery.command_json, '$.routeContext.id') = site.id
                AND delivery.status = 'blocked') AS slack_blocked_count,
            (SELECT COUNT(*) FROM transport_outbox delivery
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'slack'
                AND delivery.operation = 'slack.message.send' AND delivery.route = 'feedback'
                AND json_extract(delivery.command_json, '$.routeContext.kind') = 'site'
                AND json_extract(delivery.command_json, '$.routeContext.id') = site.id
                AND delivery.status = 'failed') AS slack_failed_count,
            (SELECT MAX(delivery.delivered_at) FROM transport_outbox delivery
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'slack'
                AND delivery.operation = 'slack.message.send' AND delivery.route = 'feedback'
                AND json_extract(delivery.command_json, '$.routeContext.kind') = 'site'
                AND json_extract(delivery.command_json, '$.routeContext.id') = site.id) AS slack_last_delivered_at,
            (SELECT delivery.last_error FROM transport_outbox delivery
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'slack'
                AND delivery.operation = 'slack.message.send' AND delivery.route = 'feedback'
                AND json_extract(delivery.command_json, '$.routeContext.kind') = 'site'
                AND json_extract(delivery.command_json, '$.routeContext.id') = site.id
                AND delivery.last_error IS NOT NULL
              ORDER BY delivery.updated_at DESC LIMIT 1) AS slack_last_error,
            (SELECT COUNT(*) FROM transport_outbox delivery
              JOIN transport_callbacks callback ON callback.transport_id = delivery.id
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'github' AND delivery.route = 'feedback'
                AND json_extract(callback.payload_json, '$.siteId') = site.id
                AND delivery.status IN ('pending', 'queued', 'processing', 'retrying')) AS github_pending_count,
            (SELECT COUNT(*) FROM transport_outbox delivery
              JOIN transport_callbacks callback ON callback.transport_id = delivery.id
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'github' AND delivery.route = 'feedback'
                AND json_extract(callback.payload_json, '$.siteId') = site.id
                AND delivery.status IN ('blocked', 'failed')) AS github_blocked_count,
            (SELECT delivery.last_error FROM transport_outbox delivery
              JOIN transport_callbacks callback ON callback.transport_id = delivery.id
              WHERE delivery.org_id = site.org_id AND delivery.provider = 'github' AND delivery.route = 'feedback'
                AND json_extract(callback.payload_json, '$.siteId') = site.id AND delivery.last_error IS NOT NULL
              ORDER BY delivery.updated_at DESC LIMIT 1) AS github_last_error
       FROM spot_sites site
      WHERE site.org_id = ?${projectId ? " AND site.project_id = ?" : ""}
      ORDER BY site.created_at DESC`,
  ).bind(...(projectId ? [orgId, projectId] : [orgId])).all<Record<string, unknown>>();

  return jsonResponse({
    sites: (results ?? []).map((row) => ({
      ...siteDto(row),
      issueCount: Number(row.issue_count ?? 0),
      openIssueCount: Number(row.open_issue_count ?? 0),
    })),
  });
}

export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, userLogin, isAdmin, projectId } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const db = getNoxDb(context.env);

  let raw: unknown;
  try { raw = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(CreateSite, raw);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  if (projectId && input.projectId && input.projectId !== projectId) return errorResponse("The requested resource was not found", 404);
  const targetProjectId = projectId || input.projectId;
  if (!targetProjectId) return errorResponse("Choose a project for the new site", 422);

  const project = await db.prepare(
    "SELECT repo FROM projects WHERE id = ? AND org_id = ? AND COALESCE(archived, 0) = 0",
  ).bind(targetProjectId, orgId).first<{ repo: string }>();
  if (!project?.repo) return errorResponse("Active project not found in this organization", 400);

  const id = crypto.randomUUID();
  const insertSite = db.prepare(
    `INSERT INTO spot_sites
       (id, org_id, project_id, repo, name, widget_config, slack_channel_id)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).bind(
    id, orgId, targetProjectId, project.repo, input.name,
    JSON.stringify({
      buttonColor: input.buttonColor ?? "#FE795D",
      buttonText: input.buttonText ?? "Report issue",
      widgetMode: input.widgetMode ?? "development",
      autoErrorLogging: input.autoErrorLogging === true,
      dailySummaryEnabled: true,
      lifecycle: "draft",
      launcher: normalizeFeedbackLauncher(input.launcher),
      environments: [],
      blocks: [],
    }),
  );
  await db.batch([
    insertSite,
    feedbackAuditStatement(db, {
      orgId,
      projectId: targetProjectId,
      siteId: id,
      actorLogin: userLogin,
      action: "site.created",
      changes: { name: input.name, projectId: targetProjectId },
    }),
  ]);

  const row = await db.prepare(
    `SELECT ${SITE_SELECT},
       (SELECT json_extract(config.data, '$.slack.fallbackChannelId') FROM config
         WHERE config.org_id = site.org_id AND config.key = 'settings') AS slack_fallback_channel_id
     FROM spot_sites site
     WHERE site.id = ? AND site.org_id = ? AND site.project_id = ?`,
  ).bind(id, orgId, targetProjectId).first<Record<string, unknown>>();

  return jsonResponse({ site: siteDto(row ?? {}) }, 201);
}
