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
import { checkSlackOrgHealth } from "../../../functions/lib/slack.js";
import {
  deliverSlackTransport,
} from "../../../functions/lib/transports/slack.ts";
import { deliverGitHubTransport } from "../../../functions/lib/transports/github.ts";
import { TransportExecutionError } from "../../../functions/lib/transport-outbox.ts";
import {
  parseTransportCommand,
  providerForOperation,
} from "../../../packages/contracts/transport-commands";
import { handleProviderIngress } from "./provider-ingress";
import {
  discoverGitHubInstallation,
  listGitHubInstallationRepositories,
} from "./github-installations";
import { validateSlackDestination } from "./slack-destination";
import { sendSlackMessage } from "./slack-message";

interface Env {
  DB: D1Database;
  TASK_QUEUE: Queue;
  BUILD_SHA?: string;
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

  discoverGitHubInstallation(ownerId: unknown) {
    return discoverGitHubInstallation(this.env, ownerId);
  }

  listGitHubInstallationRepositories(installationId: unknown) {
    return listGitHubInstallationRepositories(this.env, installationId);
  }

  deliverSlackOutbox(deliveryId: string) {
    return deliverSlackOutbox(this.env, deliveryId);
  }

  checkSlackOrgHealth(orgId: number, connectionId: string) {
    return checkSlackOrgHealth(this.env, orgId, connectionId);
  }

  validateSlackDestination(input: unknown) {
    return validateSlackDestination(this.env, input);
  }

  sendSlackMessage(input: unknown) {
    return sendSlackMessage(this.env, input);
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
