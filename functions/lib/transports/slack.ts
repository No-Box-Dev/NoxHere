import type { TransportCommand } from "../../../shared/transport-commands";
import { TransportExecutionError } from "../transport-outbox";
import { resolveProjectSlackDestination, type ProjectRouteKey } from "../project-routing";
import {
  postSlackMessage,
  resolveSlackChannels,
  resolveSlackConnectionId,
  resolveSlackInstall,
  resolveSlackRoute,
  slackInstallNeedsReconnect,
  updateSlackMessage,
} from "../slack.js";
import { markSlackChannelIssue, markSlackChannelVerified } from "../slack-channel-status.js";

type SlackCommand = Extract<TransportCommand, { operation: `slack.${string}` }>;

interface SlackTransportEnvironment {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SLACK_APP_ID?: string;
  SLACK_ACCEPT_LEGACY_INSTALLS?: string;
}

const ROUTES: Record<SlackCommand["route"], {
  projectRoute?: ProjectRouteKey;
  legacyRoute: string;
}> = {
  activity: { projectRoute: "noxfeed_posts", legacyRoute: "noxfeed_posts" },
  activity_release: { projectRoute: "noxfeed_release_notes", legacyRoute: "noxfeed_release_notes" },
  activity_summary: { legacyRoute: "noxfeed_daily_summary" },
  feedback: { legacyRoute: "noxspot" },
  incidents: { projectRoute: "noxcue_alerts", legacyRoute: "noxcue_alerts" },
  engagement: { projectRoute: "noxcue", legacyRoute: "noxcue" },
  feature_delivery: { legacyRoute: "noxticket" },
  operations: { projectRoute: "noxcue_alerts", legacyRoute: "noxcue_alerts" },
};

const BLOCKED_CODES = new Set([
  "account_inactive",
  "app_mismatch",
  "channel_not_found",
  "invalid_auth",
  "missing_scope",
  "no_permission",
  "not_authed",
  "not_in_channel",
  "token_revoked",
]);

function providerError(error: unknown): TransportExecutionError {
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "slack_delivery_failed";
  const message = typeof candidate?.message === "string" ? candidate.message : "Slack delivery failed";
  const status = Number(candidate?.status ?? 0);
  if (BLOCKED_CODES.has(code)) return new TransportExecutionError(message, code, "blocked");
  if (code === "rate_limited" || status === 429 || status >= 500 || code === "slack_delivery_failed") {
    return new TransportExecutionError(message, code, "retryable");
  }
  return new TransportExecutionError(message, code, "failed");
}

async function resolveDestination(env: SlackTransportEnvironment, command: SlackCommand) {
  const route = ROUTES[command.route];
  if (command.routeContext?.kind === "source") {
    const source = await env.DB.prepare(
      `SELECT slack_connection_id AS connection_id, slack_channel_id AS channel_id
         FROM cue_sources WHERE id = ? AND org_id = ? AND project_id = ? LIMIT 1`,
    ).bind(command.routeContext.id, command.orgId, command.projectId)
      .first<{ connection_id: string | null; channel_id: string | null }>();
    if (source?.channel_id) return {
      projectId: command.projectId,
      projectName: "",
      connectionId: source.connection_id ?? "",
      channelId: source.channel_id,
    };
  }
  if (command.routeContext?.kind === "site") {
    const site = await env.DB.prepare(
      `SELECT slack_connection_id AS connection_id, slack_channel_id AS channel_id
         FROM spot_sites WHERE id = ? AND org_id = ? AND project_id = ? LIMIT 1`,
    ).bind(command.routeContext.id, command.orgId, command.projectId)
      .first<{ connection_id: string | null; channel_id: string | null }>();
    if (site?.channel_id) return {
      projectId: command.projectId,
      projectName: "",
      connectionId: site.connection_id ?? "",
      channelId: site.channel_id,
    };
  }
  const projectDestination = route.projectRoute
    ? await resolveProjectSlackDestination(env.DB, command.orgId, route.projectRoute, { projectId: command.projectId })
    : null;
  if (projectDestination) return projectDestination;

  const channels = await resolveSlackChannels(env.DB, command.orgId, command.projectId);
  const channelId = resolveSlackRoute(channels, route.legacyRoute);
  const connectionId = resolveSlackConnectionId(channels, route.legacyRoute);
  if (!channelId) {
    throw new TransportExecutionError(
      `No Slack destination is configured for route ${command.route}`,
      "slack_route_not_configured",
      "blocked",
    );
  }
  return { projectId: command.projectId, projectName: "", connectionId, channelId };
}

export async function deliverResolvedSlackMessage(
  env: SlackTransportEnvironment,
  input: { orgId: number; connectionId?: string | null; channelId: string; messageId?: string; message: { text: string; blocks?: Record<string, unknown>[] } },
) {
  const install = await resolveSlackInstall(env, input.orgId, input.connectionId ?? null);
  if (!install) {
    throw new TransportExecutionError("Slack is not connected or its credentials cannot be decrypted", "slack_not_connected", "blocked");
  }
  if (slackInstallNeedsReconnect(env, install)) {
    throw new TransportExecutionError("Slack must be reconnected with the configured app", "app_mismatch", "blocked");
  }
  try {
    const receipt = input.messageId
      ? await updateSlackMessage(install.botToken, input.channelId, input.messageId, input.message)
      : await postSlackMessage(install.botToken, input.channelId, input.message);
    const messageId = String(receipt?.ts ?? input.messageId ?? "");
    if (!messageId || (receipt?.channel && receipt.channel !== input.channelId)) {
      throw Object.assign(new Error("Slack returned an invalid or mismatched delivery receipt"), {
        code: "invalid_slack_receipt",
      });
    }
    await markSlackChannelVerified(env.DB, input.orgId, install.id, input.channelId);
    return { channelId: input.channelId, messageId };
  } catch (error) {
    try { await markSlackChannelIssue(env.DB, input.orgId, install.id, input.channelId, error); }
    catch { /* Delivery classification must not be hidden by status persistence. */ }
    throw providerError(error);
  }
}

export async function deliverSlackTransport(env: SlackTransportEnvironment, command: TransportCommand) {
  if (!command.operation.startsWith("slack.")) {
    throw new TransportExecutionError(`Slack adapter cannot execute ${command.operation}`, "wrong_transport_provider", "failed");
  }
  const slackCommand = command as SlackCommand;
  const destination = await resolveDestination(env, slackCommand);
  return deliverResolvedSlackMessage(env, {
    orgId: slackCommand.orgId,
    connectionId: destination.connectionId,
    channelId: destination.channelId,
    messageId: slackCommand.operation === "slack.message.update" ? slackCommand.input.messageId : undefined,
    message: slackCommand.input.message,
  });
}
