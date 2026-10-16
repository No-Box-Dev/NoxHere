import { getCtx, jsonResponse, errorResponse } from "../../lib/db";
import { actionableSlackError } from "../../lib/slack";
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
  const { orgId, orgLogin, projectId, isAdmin, credentialType, scopes = [] } = getCtx(context);
  if (!orgId || !orgLogin) return errorResponse("Missing org context", 400);
  const scopedAutomation = credentialType === "api_token"
    && (scopes.includes("slack:send") || scopes.includes("slack:write"));
  if (!isAdmin && !scopedAutomation) return errorResponse("Only an organization admin can test Slack delivery. Ask an admin to send this test.", 403);

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
    if (!context.env.CONNECTIONS?.checkSlackOrgHealth) {
      return errorResponse("Slack delivery is temporarily unavailable", 503);
    }
    const health = await context.env.CONNECTIONS.checkSlackOrgHealth(orgId, connectionId);
    if (health.status !== "ok") {
      const message = actionableSlackError(health.error, "Slack connection verification failed. Reconnect the affected workspace, then send the test again.");
      return errorResponse(message, 502);
    }
  }
  if (!channelId) return errorResponse("Choose a Slack channel before sending a test message.", 400);
  if (!connectionId) return errorResponse("Choose a Slack workspace before sending a test message.", 400);
  if (!context.env.CONNECTIONS?.sendSlackMessage) {
    return errorResponse("Slack delivery is temporarily unavailable", 503);
  }

  try {
    let payload;
    if (kind === "telemetry") {
      if (sourceId) {
        const source = await context.env.DB.prepare(
          `SELECT name, timezone, project_id FROM telemetry_sources WHERE id = ? AND org_id = ?`,
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

    const delivery = await context.env.CONNECTIONS.sendSlackMessage({
      orgId,
      projectId: projectId ?? null,
      connectionId,
      channelId,
      message: payload,
    });
    if (!delivery?.ok || !delivery.result) {
      const deliveryError = delivery?.error ?? { code: "slack_delivery_failed", message: "Slack delivery failed" };
      const status = deliveryError.code === "rate_limited" ? 429
        : ["slack_not_connected", "slack_workspace_project_mismatch", "slack_channel_unavailable", "slack_channel_membership_required"].includes(deliveryError.code)
          ? 409
          : deliveryError.code === "invalid_request" ? 400 : 502;
      await markSlackChannelIssue(context.env.DB, orgId, connectionId, channelId, deliveryError);
      return errorResponse(actionableSlackError(
        deliveryError,
        "Slack did not accept the test message. Review the workspace and channel, then send the test again.",
      ), status);
    }
    await Promise.all([
      context.env.DB.prepare(
        `UPDATE slack_connections SET health_status = 'ok', last_error = NULL,
         last_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND id = ?`,
      ).bind(orgId, delivery.result.connectionId).run(),
      markSlackChannelVerified(context.env.DB, orgId, delivery.result.connectionId, channelId),
    ]);
    return jsonResponse({
      ok: true,
      connectionId: delivery.result.connectionId,
      channelId: delivery.result.channelId,
      messageTs: delivery.result.messageId,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err) {
    const deliveryError = err;
    await Promise.all([
      context.env.DB.prepare(
        `UPDATE slack_connections SET health_status = 'degraded', last_error = ?,
         last_checked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE org_id = ? AND id = ?`,
      ).bind(deliveryError instanceof Error ? deliveryError.message.slice(0, 1000) : String(deliveryError).slice(0, 1000), orgId, connectionId).run(),
      markSlackChannelIssue(context.env.DB, orgId, connectionId, channelId, deliveryError),
    ]);
    return errorResponse(actionableSlackError(deliveryError, "Slack did not accept the test message. Review the workspace and channel, then send the test again."), 502);
  }
}
