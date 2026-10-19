import { z } from "zod";
import { getCtx, jsonResponse, errorResponse } from "../../../../lib/db";
import { validate } from "../../../../lib/validate";
import { getNoxDb, type NoxDatabaseEnv } from "../../../../lib/nox-db";
import { getSlackChannel, resolveSlackChannels, resolveSlackInstall } from "../../../../lib/slack.js";
import { requeueBlockedForSite } from "../../../../lib/delivery-outbox.js";
import { requeueBlockedTransportCommands } from "../../../../lib/transport-outbox";
import { feedbackAuditStatement } from "../../../../lib/feedback-audit";
import { projectSlackDestinationErrorStatus, validateProjectSlackDestination } from "../../../../lib/project-routing";
import {
  FEEDBACK_LAUNCHER_POSITIONS,
  FEEDBACK_LAUNCHER_STYLES,
} from "../../../../../packages/contracts/feedback-launcher";

interface Ctx {
  env: NoxDatabaseEnv & {
    ENCRYPTION_KEY?: string;
    TASK_QUEUE?: Queue;
    FEEDBACK_ASSETS?: R2Bucket;
    CONNECTIONS?: { validateSlackDestination(input: unknown): Promise<unknown> };
  };
  data: { orgId: number; projectId?: string | null; userLogin: string; isAdmin: boolean };
  request: Request;
  params: { id: string };
}

const EnvironmentInput = z.object({
  name: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1).max(500).refine((value) => {
    try { new URL(value.includes("://") ? value : `https://${value}`); return true; }
    catch { return false; }
  }, "Invalid environment URL"),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  buttonText: z.string().trim().min(1).max(40).nullable().optional(),
  widgetMode: z.enum(["development", "release"]).nullable().optional(),
  captureMode: z.enum(["screenshot", "dom"]).nullable().optional(),
  enabled: z.boolean().optional(),
});

const BlockInput = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
  type: z.enum([
    "title", "description", "reporter", "contact_email", "category", "custom_text",
    "custom_textarea", "custom_select", "element_picker", "metadata", "console_logs",
  ]),
  label: z.string().trim().max(120).nullable().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  environments: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
}).superRefine((block, ctx) => {
  if (block.type === "custom_select" && (!block.options || block.options.length === 0)) {
    ctx.addIssue({ code: "custom", message: "Select blocks require at least one option", path: ["options"] });
  }
  if (block.type !== "custom_select" && block.options?.length) {
    ctx.addIssue({ code: "custom", message: "Only select blocks accept options", path: ["options"] });
  }
});

const LauncherViewportInput = z.object({
  style: z.enum(FEEDBACK_LAUNCHER_STYLES),
  position: z.enum(FEEDBACK_LAUNCHER_POSITIONS),
});

const LauncherInput = z.object({
  desktop: LauncherViewportInput,
  mobile: LauncherViewportInput,
});

const UpdateSite = z.object({
  projectId: z.string().trim().min(1).max(240).optional(),
  slackChannelId: z.string().trim().max(80).nullable().optional(),
  slackConnectionId: z.string().trim().min(1).max(120).nullable().optional(),
  dailySummaryEnabled: z.boolean().optional(),
  autoErrorLogging: z.boolean().optional(),
  widgetMode: z.enum(["development", "release"]).optional(),
  launcher: LauncherInput.optional(),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  buttonText: z.string().trim().min(1).max(40).optional(),
  environments: z.array(EnvironmentInput).max(50).superRefine((environments, ctx) => {
    const names = new Set<string>();
    for (let index = 0; index < environments.length; index += 1) {
      const key = environments[index].name.toLowerCase();
      if (names.has(key)) ctx.addIssue({ code: "custom", message: "Environment names must be unique", path: [index, "name"] });
      names.add(key);
    }
  }).optional(),
  blocks: z.array(BlockInput).max(30).superRefine((blocks, ctx) => {
    const ids = new Set<string>();
    for (let index = 0; index < blocks.length; index += 1) {
      if (ids.has(blocks[index].id)) ctx.addIssue({ code: "custom", message: "Block IDs must be unique", path: [index, "id"] });
      ids.add(blocks[index].id);
    }
    const descriptions = blocks.filter((block) => block.type === "description");
    if (blocks.length > 0 && (descriptions.length !== 1 || descriptions[0].required !== true)) {
      ctx.addIssue({ code: "custom", message: "A custom form must contain one required description block" });
    }
    if (blocks.filter((block) => block.type === "title").length > 1) {
      ctx.addIssue({ code: "custom", message: "A custom form can contain at most one title block" });
    }
  }).optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function onRequestPatch(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const db = getNoxDb(context.env);

  let raw: unknown;
  try { raw = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(UpdateSite, raw);
  if (!parsed.ok) return parsed.response;

  const existing = await db.prepare(
    `SELECT id, project_id, repo, slack_channel_id, slack_connection_id, widget_config
       FROM spot_sites WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first<Record<string, unknown>>();
  if (!existing) return errorResponse("Feedback site not found", 404);
  const resourceProjectId = String(existing.project_id);

  const input = parsed.data;
  const targetProjectId = input.projectId ?? resourceProjectId;
  if (targetProjectId !== resourceProjectId) {
    const target = await db.prepare(
      `SELECT project.id
         FROM projects project
        WHERE project.id = ? AND project.org_id = ? AND COALESCE(project.archived, 0) = 0
          AND (project.repo = ? COLLATE NOCASE OR EXISTS (
            SELECT 1 FROM project_repositories assignment
             WHERE assignment.org_id = project.org_id AND assignment.project_id = project.id
               AND assignment.repo = ? COLLATE NOCASE
          ))`,
    ).bind(targetProjectId, orgId, existing.repo, existing.repo).first<{ id: string }>();
    if (!target) return errorResponse("The target project must be active and include this site's repository", 409);
  }
  let validatedSlackConnectionId = input.slackConnectionId !== undefined
    ? input.slackConnectionId : existing.slack_connection_id;
  if (input.slackChannelId) {
    const connectionId = validatedSlackConnectionId;
    if (context.env.CONNECTIONS?.validateSlackDestination) {
      try {
        validatedSlackConnectionId = await validateProjectSlackDestination(
          context.env,
          orgId,
          targetProjectId,
          { connectionId: String(connectionId || "") || null, channelId: input.slackChannelId },
        );
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Slack channel validation failed", projectSlackDestinationErrorStatus(error));
      }
    } else {
      const slack = await resolveSlackInstall({ ...context.env, DB: db }, orgId, String(connectionId || "") || null);
      if (!slack) return errorResponse("Connect Slack in Integrations before selecting a channel", 409);
      try {
        const channel = await getSlackChannel(slack.botToken, input.slackChannelId);
        if (!channel || channel.is_archived) return errorResponse("Slack channel is archived or unavailable", 409);
        if (channel.is_private && !channel.is_member) return errorResponse("Invite the Feedback bot to this private channel first", 409);
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Slack channel is unavailable", 409);
      }
    }
  }
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(String(existing.widget_config || "{}")); } catch { /* replace corrupt config */ }
  const finalEnvironments = input.environments ?? (Array.isArray(config.environments) ? config.environments : []);
  const finalBlocks = input.blocks ?? (Array.isArray(config.blocks) ? config.blocks : []);
  const environmentNames = new Set(finalEnvironments.map((environment) => String((environment as { name?: unknown }).name ?? "")));
  const missingEnvironment = finalBlocks.flatMap((block) =>
    Array.isArray((block as { environments?: unknown }).environments)
      ? ((block as { environments: unknown[] }).environments.filter((name) => typeof name === "string" && !environmentNames.has(name)) as string[])
      : [],
  )[0];
  if (missingEnvironment) return errorResponse(`Block references unknown environment: ${missingEnvironment}`, 400);
  for (const key of ["buttonColor", "buttonText", "widgetMode", "launcher", "autoErrorLogging", "dailySummaryEnabled", "environments", "blocks"] as const) {
    if (input[key] !== undefined) config[key] = input[key];
  }
  const updateStatement = db.prepare(
    `UPDATE spot_sites SET project_id = ?, slack_channel_id = ?, slack_connection_id = ?, widget_config = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ? AND org_id = ? AND project_id = ?`,
  ).bind(
    targetProjectId,
    input.slackChannelId !== undefined ? input.slackChannelId || null : existing.slack_channel_id,
    input.slackConnectionId !== undefined ? validatedSlackConnectionId || null : existing.slack_connection_id,
    JSON.stringify(config),
    context.params.id,
    orgId,
    resourceProjectId,
  );
  const moveStatements: D1PreparedStatement[] = [];
  if (targetProjectId !== resourceProjectId) {
    moveStatements.push(
      db.prepare("UPDATE spot_reports SET project_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND site_id = ? AND project_id = ?")
        .bind(targetProjectId, orgId, context.params.id, resourceProjectId),
      db.prepare("UPDATE delivery_outbox SET project_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND site_id = ? AND project_id = ?")
        .bind(targetProjectId, orgId, context.params.id, resourceProjectId),
    );
    const evidenceTable = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'feedback_assets'",
    ).first<{ name: string }>();
    if (evidenceTable) {
      moveStatements.push(
        db.prepare("UPDATE feedback_assets SET project_id = ? WHERE org_id = ? AND site_id = ? AND project_id = ?")
          .bind(targetProjectId, orgId, context.params.id, resourceProjectId),
      );
    }
  }
  await db.batch([
    updateStatement,
    ...moveStatements,
    feedbackAuditStatement(db, {
      orgId,
      projectId: targetProjectId,
      siteId: context.params.id,
      actorLogin: userLogin,
      action: targetProjectId === resourceProjectId ? "site.updated" : "site.migrated",
      changes: targetProjectId === resourceProjectId ? input : { ...input, previousProjectId: resourceProjectId },
    }),
  ]);

  if (input.slackChannelId !== undefined) {
    if (input.slackChannelId) {
      await db.prepare(
        `UPDATE delivery_outbox SET channel_id = ?, slack_connection_id = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE org_id = ? AND site_id = ? AND source = 'feedback'
           AND destination = 'slack' AND status != 'delivered'`,
      ).bind(input.slackChannelId, validatedSlackConnectionId ?? null, orgId, context.params.id).run();
      await requeueBlockedForSite({ ...context.env, DB: db }, orgId, context.params.id);
    } else {
      const channels = await resolveSlackChannels(db, orgId, targetProjectId);
      if (channels.fallbackChannelId) {
        await db.prepare(
          `UPDATE delivery_outbox SET channel_id = ?, slack_connection_id = ?, status = 'pending',
             last_error_code = NULL, last_error = NULL, next_attempt_at = NULL,
             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
           WHERE org_id = ? AND site_id = ? AND source = 'feedback'
             AND destination = 'slack' AND status != 'delivered'`,
        ).bind(channels.fallbackChannelId, channels.fallbackConnectionId || null, orgId, context.params.id).run();
        await requeueBlockedForSite({ ...context.env, DB: db }, orgId, context.params.id);
      } else {
        await db.prepare(
          `UPDATE delivery_outbox SET status = 'blocked_configuration',
             last_error_code = 'alerts_disabled', last_error = 'No Feedback site or organization fallback channel is configured',
             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
           WHERE org_id = ? AND site_id = ? AND source = 'feedback'
             AND destination = 'slack' AND status != 'delivered'`,
        ).bind(orgId, context.params.id).run();
      }
    }
    if (context.env.TASK_QUEUE) {
      await requeueBlockedTransportCommands(
        { DB: db, TASK_QUEUE: context.env.TASK_QUEUE },
        { orgId, projectId: targetProjectId, routeContext: { kind: "site", id: context.params.id } },
      );
    }
  }

  return jsonResponse({ ok: true });
}

export async function onRequestDelete(context: Ctx): Promise<Response> {
  const { orgId, projectId, userLogin, isAdmin } = getCtx(context) as Ctx["data"];
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  if (!context.env.FEEDBACK_ASSETS) return errorResponse("Screenshot storage is unavailable", 503);
  const db = getNoxDb(context.env);

  const site = await db.prepare(
    `SELECT id, project_id FROM spot_sites
      WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}`,
  ).bind(...(projectId ? [context.params.id, orgId, projectId] : [context.params.id, orgId])).first<{ id: string; project_id: string }>();
  if (!site) return errorResponse("Feedback site not found", 404);

  const prefix = `screenshots/${site.id}/`;
  let cursor: string | undefined;
  do {
    const page = await context.env.FEEDBACK_ASSETS.list({ prefix, cursor });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) await context.env.FEEDBACK_ASSETS.delete(keys);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  await db.batch([
    db.prepare(
      "DELETE FROM delivery_outbox WHERE org_id = ? AND site_id = ? AND source = 'feedback'",
    ).bind(orgId, site.id),
    feedbackAuditStatement(db, {
      orgId,
      projectId: site.project_id,
      siteId: site.id,
      actorLogin: userLogin,
      action: "site.deleted",
    }),
    db.prepare("DELETE FROM spot_sites WHERE id = ? AND org_id = ? AND project_id = ?").bind(site.id, orgId, site.project_id),
  ]);
  return jsonResponse({ ok: true });
}
