import { z } from "zod";
import { getSlackChannel, resolveSlackInstall } from "../../../functions/lib/slack.js";

interface SlackDestinationEnv {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
}

const SlackDestinationInput = z.object({
  orgId: z.number().int().positive(),
  projectId: z.string().trim().min(1).max(160).nullable(),
  connectionId: z.string().trim().min(1).max(120),
  channelId: z.string().trim().min(1).max(80),
}).strict();

export type SlackDestinationValidationResult =
  | { ok: true; result: { connectionId: string } }
  | { ok: false; error: { code: string; message: string; status: 400 | 409 | 503 } };

type ResolvedSlackDestination =
  | { ok: true; install: { id: string; projectId: string | null; botToken: string } }
  | Extract<SlackDestinationValidationResult, { ok: false }>;

export async function resolveSlackDestination(
  env: SlackDestinationEnv,
  input: unknown,
): Promise<ResolvedSlackDestination> {
  const parsed = SlackDestinationInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "invalid_request", message: "Slack destination input is invalid", status: 400 },
    };
  }

  const { orgId, projectId, connectionId, channelId } = parsed.data;
  const install = await resolveSlackInstall(env, orgId, connectionId);
  if (!install) {
    return {
      ok: false,
      error: {
        code: "slack_not_connected",
        message: "Connect the selected Slack workspace before choosing a channel",
        status: 409,
      },
    };
  }
  const explicitlyRouted = install.projectId && install.projectId !== projectId && projectId
    ? await env.DB.prepare(
      `SELECT 1 FROM project_slack_routes
        WHERE org_id = ? AND project_id = ? AND connection_id = ? LIMIT 1`,
    ).bind(orgId, projectId, install.id).first().then(Boolean).catch(() => false)
    : false;
  if (install.projectId && install.projectId !== projectId && !explicitlyRouted) {
    return {
      ok: false,
      error: {
        code: "slack_workspace_project_mismatch",
        message: projectId
          ? "The selected Slack workspace belongs to another project"
          : "Link this source to the project that owns the selected Slack workspace",
        status: 409,
      },
    };
  }

  try {
    const channel = await getSlackChannel(install.botToken, channelId);
    if (!channel || channel.is_archived) {
      return {
        ok: false,
        error: {
          code: "slack_channel_unavailable",
          message: "Slack channel is archived or unavailable",
          status: 409,
        },
      };
    }
    if (channel.is_private && !channel.is_member) {
      return {
        ok: false,
        error: {
          code: "slack_channel_membership_required",
          message: "Invite the Nox bot to this private channel first",
          status: 409,
        },
      };
    }
    return { ok: true, install };
  } catch {
    return {
      ok: false,
      error: {
        code: "slack_validation_unavailable",
        message: "Slack channel validation is temporarily unavailable",
        status: 503,
      },
    };
  }
}

export async function validateSlackDestination(
  env: SlackDestinationEnv,
  input: unknown,
): Promise<SlackDestinationValidationResult> {
  const resolved = await resolveSlackDestination(env, input);
  return resolved.ok
    ? { ok: true, result: { connectionId: resolved.install.id } }
    : resolved;
}
