import { getCtx, jsonResponse, errorResponse } from "../../lib/db";
import { actionableSlackError, checkSlackOrgHealth, getSlackChannel, resolveSlackInstall } from "../../lib/slack";
import { deliverResolvedSlackMessage } from "../../lib/transports/slack";
import { markSlackChannelIssue, markSlackChannelVerified } from "../../lib/slack-channel-status";
import { getTelemetryDigestResponse, getTelemetryTestResponse } from "../../lib/telemetry-response.js";
import { completedPeriodAt, loadTelemetryDigestData } from "../../lib/telemetry-digest-data.js";
import { loadEnabledTelemetryMetricKeys, selectTelemetryDigestMetrics } from "../../lib/telemetry-project-metrics.js";
import { getFeedbackDailyDigestResponse, getFeedbackTestResponse } from "../../lib/feedback-response.js";
import { summarizeFeedbackResolutions } from "../../lib/feedback-digest-ai.js";
import {
  completedDailyDigestPeriod,
  loadFeedbackDailyDigestData,
} from "../../../services/scheduler/src/feedback-digests.js";
import { getActivityTestResponse } from "../../lib/activity-response.js";
import { buildPlanningTestResponse } from "../../products/planning/response.js";

// POST /api/slack/test
// Body: { connectionId?: string, channelId?: string, kind: "connection" | "fallback" | "telemetry" | "telemetry_alerts" | "feedback" | "planning" | "activity_posts" | "activity_release_notes" | "activity_daily_summary", sourceId?: string }
//
// Admin-only. Posts a sample message to the given channel so the admin can
// verify the bot is installed in the right workspace + the channel routes
// correctly before saving the channel selection.
export async function onRequestPost(context) {
  const { orgId, orgLogin, isAdmin } = getCtx(context);
  if (!orgId || !orgLogin) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Only an organization admin can test Slack delivery. Ask an admin to send this test.", 403);

  let body;
  try { body = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const connectionId = typeof body?.connectionId === "string" ? body.connectionId.trim() : null;
  const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId.trim() : "";
  const legacyKinds = { narrative: "activity_posts", release_notes: "activity_release_notes" };
  const allowedKinds = new Set([
    "connection", "fallback", "telemetry", "telemetry_alerts", "feedback", "planning", "activity",
    "activity_posts", "activity_release_notes", "activity_daily_summary",
  ]);
  const kind = legacyKinds[body?.kind] ?? (allowedKinds.has(body?.kind) ? body.kind : null);
  if (!kind) return errorResponse("This Slack test type is not supported. Refresh NoxHere and run the test again.", 400);
  if (kind === "connection") {
    if (!connectionId) return errorResponse("Choose a Slack workspace before sending a connection test.", 400);
    if (!channelId) return errorResponse("Choose a Slack channel before sending a connection test.", 400);
    const health = await checkSlackOrgHealth(context.env, orgId, connectionId);
    if (health.status !== "ok") {
      const message = actionableSlackError(health.error, "Slack connection verification failed. Reconnect the affected workspace, then send the test again.");
      return errorResponse(message, 502);
    }
  }
  if (!channelId) return errorResponse("Choose a Slack channel before sending a test message.", 400);

  const install = await resolveSlackInstall(context.env, orgId, connectionId);
  if (!install) return errorResponse("This Slack workspace is not connected or its authorization cannot be read. Reconnect it, then send the test again.", 404);

  try {
    let payload;
    if (kind === "telemetry") {
      if (sourceId) {
        const source = await context.env.DB.prepare(
          `SELECT name, timezone, project_id FROM cue_sources WHERE id = ? AND org_id = ?`,
        ).bind(sourceId, orgId).first();
        if (!source) return errorResponse("This Telemetry source no longer exists. Refresh the source list and choose an existing source.", 404);
        const period = completedPeriodAt(source.timezone);
        const digest = await loadTelemetryDigestData(context.env.DB, sourceId, period);
        if (!digest.hasData) return errorResponse("This Telemetry source has no completed daily user statistics yet. Send user events for the source, wait until its first day is complete, then test again.", 404);
        const enabledKeys = await loadEnabledTelemetryMetricKeys(context.env.DB, orgId, source.project_id, sourceId);
        const selected = selectTelemetryDigestMetrics(digest, enabledKeys);
        payload = (await getTelemetryDigestResponse(
          context.env,
          source.name,
          period,
          selected.metrics,
          selected.comparisons,
          selected.metricLabels,
          selected.activityBreakdowns,
          source.project_id ? { organizationId: orgId, projectId: source.project_id, sourceId } : undefined,
        )).message;
      } else {
        payload = (await getTelemetryTestResponse(context.env, orgLogin)).message;
      }
    } else if (kind === "telemetry_alerts") {
      payload = {
        text: `Telemetry alert delivery test for ${orgLogin}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🚨 Telemetry alert delivery test", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `Immediate app errors for *${orgLogin}* will be delivered to this channel through NoxHere.` } },
        ],
      };
    } else if (kind === "feedback") {
      if (sourceId) {
        const site = await context.env.DB.prepare(
          `SELECT site.id, site.org_id, site.project_id, site.repo, site.name, site.widget_config,
                  site.slack_channel_id, site.slack_connection_id,
                  org.github_login AS owner_id
             FROM spot_sites site
             JOIN orgs org ON org.id = site.org_id
            WHERE site.id = ? AND site.org_id = ? LIMIT 1`,
        ).bind(sourceId, orgId).first();
        if (!site) return errorResponse("This Feedback site no longer exists. Refresh NoxHere and try again.", 404);
        const period = completedDailyDigestPeriod(Date.now());
        const digest = await loadFeedbackDailyDigestData(context.env.DB, site, period);
        const solved = await summarizeFeedbackResolutions(context.env, orgId, context.data.projectId, digest.solved);
        payload = (await getFeedbackDailyDigestResponse(
          context.env,
          `${site.name} — test`,
          period,
          digest.filed,
          solved,
          digest.totals,
        )).message;
      } else {
        payload = (await getFeedbackTestResponse(context.env, orgLogin)).message;
      }
    } else if (kind === "planning") {
      payload = context.env.PLANNING_SERVICE?.buildTestMessage
        ? await context.env.PLANNING_SERVICE.buildTestMessage(orgLogin)
        : buildPlanningTestResponse(orgLogin).message;
    } else if (kind === "activity_daily_summary") {
      payload = {
        text: `Activity daily summary delivery test for ${orgLogin}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "What happened today — test", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `Daily summaries for *${orgLogin}* will be delivered to this channel at the saved local time.` } },
        ],
      };
    } else if (kind === "activity" || kind === "activity_posts" || kind === "activity_release_notes") {
      const stream = kind === "activity_posts" ? "posts" : kind === "activity_release_notes" ? "release_notes" : "all";
      payload = (await getActivityTestResponse(context.env, orgLogin, stream)).message;
    } else payload = kind === "connection" ? {
        text: `NoxHere workspace test for ${orgLogin}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "NoxHere workspace test", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `Workspace authentication and channel delivery are working for *${orgLogin}*.` } },
        ],
      }
    : kind === "fallback" ? {
        text: `NoxHere fallback test for ${orgLogin}`,
        blocks: [{ type: "section", text: { type: "mrkdwn", text: `*NoxHere — organization fallback test*\nUnassigned service messages for \`${orgLogin}\` can be delivered here.` } }],
      }
      : null;

    const receipt = await deliverResolvedSlackMessage(context.env, {
      orgId,
      connectionId,
      channelId,
      message: payload,
    });
    await Promise.all([
      context.env.DB.prepare(
        `UPDATE slack_connections SET health_status = 'ok', last_error = NULL,
         last_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND id = ?`,
      ).bind(orgId, install.id).run(),
      markSlackChannelVerified(context.env.DB, orgId, install.id, channelId),
    ]);
    return jsonResponse({
      ok: true,
      connectionId: install.id,
      channelId: receipt.channelId,
      messageTs: receipt.messageId,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err) {
    let deliveryError = err;
    if (err?.code === "channel_not_found") {
      try {
        const channel = await getSlackChannel(install.botToken, channelId);
        if (channel && !channel.is_member) {
          deliveryError = Object.assign(new Error("NoxHere is not a member of this channel"), { code: "not_in_channel" });
        }
      } catch { /* Keep Slack's original error when the channel is not visible to this workspace token. */ }
    }
    await Promise.all([
      context.env.DB.prepare(
        `UPDATE slack_connections SET health_status = 'degraded', last_error = ?,
         last_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND id = ?`,
      ).bind(deliveryError instanceof Error ? deliveryError.message.slice(0, 1000) : String(deliveryError).slice(0, 1000), orgId, install.id).run(),
      markSlackChannelIssue(context.env.DB, orgId, install.id, channelId, deliveryError),
    ]);
    return errorResponse(actionableSlackError(deliveryError, "Slack did not accept the test message. Review the workspace and channel, then send the test again."), 502);
  }
}
