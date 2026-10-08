import { z } from "zod";
import { getCtx } from "../../../../lib/db";
import { v1Error, v1Response } from "../../../../lib/api-v1";
import { actionableSlackError, getSlackChannel, resolveSlackInstall } from "../../../../lib/slack.js";
import {
  deliverResolvedSlackMessage,
  type SlackMessagePayload,
} from "../../../../lib/transports/slack";

const MAX_REQUEST_BYTES = 64 * 1024;
const JsonObject = z.record(z.string(), z.unknown());
const SlackMessage = z.object({
  text: z.string().max(40_000).optional(),
  markdown_text: z.string().max(12_000).optional(),
  blocks: z.array(JsonObject).max(50).optional(),
  attachments: z.array(JsonObject).max(100).optional(),
  metadata: z.object({
    event_type: z.string().trim().min(1).max(80),
    event_payload: JsonObject,
  }).strict().optional(),
  thread_ts: z.string().trim().regex(/^\d{1,20}\.\d{1,20}$/).optional(),
  reply_broadcast: z.boolean().optional(),
  mrkdwn: z.boolean().optional(),
  parse: z.enum(["none", "full"]).optional(),
  link_names: z.boolean().optional(),
  unfurl_links: z.boolean().optional(),
  unfurl_media: z.boolean().optional(),
  username: z.string().trim().min(1).max(80).optional(),
  icon_emoji: z.string().trim().regex(/^:[a-zA-Z0-9_+-]+:$/).optional(),
  icon_url: z.url({ protocol: /^https$/ }).max(2_048).optional(),
  client_msg_id: z.uuid().optional(),
}).strict().superRefine((message, ctx) => {
  if (!message.text?.trim() && !message.markdown_text?.trim() && !message.blocks?.length && !message.attachments?.length) {
    ctx.addIssue({ code: "custom", message: "Add message text, markdown_text, blocks, or attachments" });
  }
  if (message.markdown_text && (message.text !== undefined || message.blocks !== undefined)) {
    ctx.addIssue({ code: "custom", message: "markdown_text cannot be combined with text or blocks" });
  }
  if (message.reply_broadcast && !message.thread_ts) {
    ctx.addIssue({ code: "custom", message: "reply_broadcast requires thread_ts" });
  }
  if (message.icon_emoji && message.icon_url) {
    ctx.addIssue({ code: "custom", message: "Use icon_emoji or icon_url, not both" });
  }
});

const SlackMessageRequest = z.object({
  connectionId: z.string().trim().min(1).max(120),
  channelId: z.string().trim().min(1).max(80),
  message: SlackMessage,
}).strict();

interface Ctx {
  env: Env;
  data: {
    orgId: number;
    projectId?: string | null;
    orgLogin?: string;
    isAdmin: boolean;
  };
  request: Request;
}

async function boundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) throw new Error("too_large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_REQUEST_BYTES) throw new Error("too_large");
  return JSON.parse(new TextDecoder().decode(bytes));
}

// A deliberately thin bridge over the existing encrypted Slack installation.
// The browser supplies only a connection id, channel id, and Slack message fields;
// the bot token is resolved and used exclusively inside the Worker.
export async function onRequestPost(context: Ctx): Promise<Response> {
  const { orgId, projectId, isAdmin } = getCtx(context);
  if (!orgId) return v1Error("missing_org_context", "Missing organization context", 400);
  if (!projectId) return v1Error("project_required", "Select a project before sending a Slack message", 400);
  if (!isAdmin) return v1Error("admin_required", "Only an organization admin can send Slack messages", 403);
  if (!context.request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return v1Error("unsupported_media_type", "Content-Type must be application/json", 415);
  }

  let raw: unknown;
  try {
    raw = await boundedJson(context.request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too_large";
    return v1Error(
      tooLarge ? "payload_too_large" : "invalid_request",
      tooLarge ? "Slack message payload exceeds 64 KB" : "Request body must be valid JSON",
      tooLarge ? 413 : 400,
    );
  }

  const candidate = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  if (typeof candidate.connectionId !== "string" || !candidate.connectionId.trim()) {
    return v1Error("slack_workspace_required", "Choose a Slack workspace before sending the message", 422);
  }
  if (typeof candidate.channelId !== "string" || !candidate.channelId.trim()) {
    return v1Error("slack_channel_required", "Choose a Slack channel before sending the message", 422);
  }

  const parsed = SlackMessageRequest.safeParse(raw);
  if (!parsed.success) {
    return v1Error("validation_failed", "Slack message fields are invalid", 422, {
      issues: parsed.error.issues,
    });
  }

  const install = await resolveSlackInstall(context.env, orgId, parsed.data.connectionId);
  if (!install) {
    return v1Error(
      "slack_not_connected",
      "The selected Slack workspace is not connected or its authorization cannot be read. Reconnect it, then try again.",
      409,
    );
  }
  if (install.projectId && install.projectId !== projectId) {
    return v1Error(
      "slack_workspace_project_mismatch",
      "The selected Slack workspace belongs to another project. Choose a workspace assigned to this project.",
      409,
    );
  }

  try {
    const channel = await getSlackChannel(install.botToken, parsed.data.channelId);
    if (!channel || channel.is_archived) {
      return v1Error("slack_channel_unavailable", "This Slack channel is archived or unavailable. Choose an active channel, then try again.", 409);
    }
    if (channel.is_private && !channel.is_member) {
      return v1Error("slack_channel_membership_required", "NoxConnect is not in this private channel. Invite @NoxConnect in Slack, then try again.", 409);
    }

    const message: SlackMessagePayload = parsed.data.message;
    const receipt = await deliverResolvedSlackMessage(context.env, {
      orgId,
      connectionId: parsed.data.connectionId,
      channelId: parsed.data.channelId,
      message,
    });
    return v1Response({
      apiVersion: 1,
      delivery: {
        status: "sent",
        connectionId: install.id,
        channelId: receipt.channelId,
        messageTs: receipt.messageId,
        sentAt: new Date().toISOString(),
      },
    }, 201);
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? "slack_delivery_failed");
    const status = code === "rate_limited" ? 429 : 502;
    return v1Error(
      code,
      actionableSlackError(error, "Slack did not accept the message. Review the workspace, channel, and Slack message fields, then try again."),
      status,
    );
  }
}
