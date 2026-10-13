import { WorkerEntrypoint } from "cloudflare:workers";
import { executeConnectionCapability } from "../../../functions/lib/connection-capability-executor";
import {
  exchangeLegacyGitHubCredential,
  exchangeGitHubOAuthIdentity,
  pollGitHubDeviceIdentity,
  refreshGitHubIdentity,
  resolveIdentityConnection,
  startGitHubDeviceIdentity,
} from "../../../functions/lib/connection-identity";
import { sendTransactionalEmail } from "../../../functions/lib/transactional-email";
import { getInstallationToken } from "../../../functions/lib/github-app.js";
import { deliverSlackOutbox } from "../../../functions/lib/delivery-outbox.js";
import {
  deliverFeedbackResolutionEmail,
  prepareFeedbackResolutionEmail,
} from "../../../functions/lib/feedback-resolution.js";
import { checkSlackOrgHealth, getSlackChannel, resolveSlackInstall } from "../../../functions/lib/slack.js";
import {
  deliverResolvedSlackMessage,
  deliverSlackTransport,
  type SlackMessagePayload,
} from "../../../functions/lib/transports/slack.ts";
import { deliverGitHubTransport } from "../../../functions/lib/transports/github.ts";
import { TransportExecutionError } from "../../../functions/lib/transport-outbox.ts";
import {
  parseTransportCommand,
  providerForOperation,
} from "../../../packages/contracts/transport-commands";
import { handleProviderIngress } from "./provider-ingress";

interface Env {
  DB: D1Database;
  TASK_QUEUE: Queue;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ENCRYPTION_KEY?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  NOXHERE_OAUTH_CALLBACK_URL?: string;
  POSTMARK_SERVER_TOKEN?: string;
  PLATFORM_EMAIL_FROM?: string;
  FEEDBACK_EMAIL_FROM?: string;
  FEEDBACK_PUBLIC_URL?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  POSTMARK_WEBHOOK_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_SIGNING_SECRET?: string;
}

export default class NoxHereCapabilities extends WorkerEntrypoint<Env> {
  execute(command: unknown) {
    return executeConnectionCapability(this.env, command);
  }

  exchangeGitHubOAuth(input: unknown) {
    return exchangeGitHubOAuthIdentity(this.env, input);
  }

  exchangeLegacyGitHubCredential(input: unknown) {
    return exchangeLegacyGitHubCredential(this.env, input);
  }

  refreshGitHubIdentity(input: unknown) {
    return refreshGitHubIdentity(this.env, input);
  }

  startGitHubDeviceAuth(input: unknown) {
    return startGitHubDeviceIdentity(this.env, input);
  }

  pollGitHubDeviceAuth(input: unknown) {
    return pollGitHubDeviceIdentity(this.env, input);
  }

  resolveGitHubIdentity(connectionId: unknown) {
    if (typeof connectionId !== "string"
        || !connectionId.startsWith("noxic_")
        || connectionId.length > 256) {
      throw new Error("invalid_identity_connection");
    }
    return resolveIdentityConnection(this.env, connectionId);
  }

  getProviderConfiguration() {
    return {
      github: Boolean(this.env.GITHUB_APP_ID && this.env.GITHUB_APP_PRIVATE_KEY && this.env.GITHUB_WEBHOOK_SECRET),
      slack: Boolean(this.env.ENCRYPTION_KEY && this.env.SLACK_CLIENT_ID && this.env.SLACK_CLIENT_SECRET && this.env.SLACK_SIGNING_SECRET),
      postmark: Boolean(this.env.POSTMARK_SERVER_TOKEN && this.env.POSTMARK_WEBHOOK_SECRET),
    };
  }

  sendEmail(input: unknown) {
    return sendTransactionalEmail(this.env, input);
  }

  getGitHubInstallationToken(installationId: unknown) {
    if (!Number.isInteger(installationId) || Number(installationId) <= 0) {
      throw new Error("A valid GitHub installation ID is required");
    }
    return getInstallationToken(this.env, Number(installationId));
  }

  deliverSlackOutbox(deliveryId: string) {
    return deliverSlackOutbox(this.env, deliveryId);
  }

  checkSlackOrgHealth(orgId: number, connectionId: string) {
    return checkSlackOrgHealth(this.env, orgId, connectionId);
  }

  async sendSlackMessage(input: unknown) {
    const candidate = input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {};
    const orgId = Number(candidate.orgId);
    const projectId = typeof candidate.projectId === "string" ? candidate.projectId.trim() : "";
    const connectionId = typeof candidate.connectionId === "string" ? candidate.connectionId.trim() : "";
    const channelId = typeof candidate.channelId === "string" ? candidate.channelId.trim() : "";
    const message = candidate.message && typeof candidate.message === "object" && !Array.isArray(candidate.message)
      ? candidate.message as SlackMessagePayload
      : null;
    if (!Number.isSafeInteger(orgId) || orgId < 1 || !projectId || !connectionId || !channelId || !message) {
      return { ok: false as const, error: { code: "invalid_request", message: "Slack delivery input is invalid" } };
    }

    const install = await resolveSlackInstall(this.env, orgId, connectionId);
    if (!install) {
      return { ok: false as const, error: { code: "slack_not_connected", message: "Slack is not connected or its credentials cannot be decrypted" } };
    }
    if (install.projectId && install.projectId !== projectId) {
      return { ok: false as const, error: { code: "slack_workspace_project_mismatch", message: "The selected Slack workspace belongs to another project" } };
    }

    try {
      const channel = await getSlackChannel(install.botToken, channelId);
      if (!channel || channel.is_archived) {
        return { ok: false as const, error: { code: "slack_channel_unavailable", message: "The Slack channel is archived or unavailable" } };
      }
      if (channel.is_private && !channel.is_member) {
        return { ok: false as const, error: { code: "slack_channel_membership_required", message: "NoxHere is not a member of the private Slack channel" } };
      }
      const receipt = await deliverResolvedSlackMessage(this.env, { orgId, connectionId, channelId, message });
      return { ok: true as const, result: { connectionId: install.id, ...receipt } };
    } catch (error) {
      return {
        ok: false as const,
        error: {
          code: String((error as { code?: unknown })?.code ?? "slack_delivery_failed"),
          message: error instanceof Error ? error.message : "Slack delivery failed",
        },
      };
    }
  }

  async deliverTransport(input: unknown) {
    const command = parseTransportCommand(input);
    try {
      const result = providerForOperation(command.operation) === "slack"
        ? await deliverSlackTransport(this.env, command)
        : await deliverGitHubTransport(this.env, command);
      return { ok: true as const, result };
    } catch (error) {
      const normalized = error instanceof TransportExecutionError
        ? error
        : new TransportExecutionError(
          error instanceof Error ? error.message : String(error ?? "Unknown transport error"),
          "transport_failed",
        );
      return {
        ok: false as const,
        error: {
          message: normalized.message,
          code: normalized.code,
          disposition: normalized.disposition,
        },
      };
    }
  }

  prepareFeedbackResolutionEmail(reportId: string) {
    return prepareFeedbackResolutionEmail({
      ...this.env,
      NOXHERE: {
        execute: (command: unknown) => executeConnectionCapability(this.env, command),
      },
    }, reportId);
  }

  deliverFeedbackResolutionEmail(reportId: string) {
    return deliverFeedbackResolutionEmail({
      ...this.env,
      NOXHERE_EMAIL: {
        sendEmail: (input: unknown) => sendTransactionalEmail(this.env, input),
      },
    }, reportId);
  }

  fetch(request: Request): Promise<Response> {
    return handleProviderIngress({
      request,
      env: this.env,
      waitUntil: (work) => this.ctx.waitUntil(work),
    });
  }
}
