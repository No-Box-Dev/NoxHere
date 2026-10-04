import { WorkerEntrypoint } from "cloudflare:workers";
import { executeConnectionCapability } from "../../../functions/lib/connection-capability-executor";
import {
  exchangeGitHubOAuthIdentity,
  pollGitHubDeviceIdentity,
  refreshGitHubIdentity,
  startGitHubDeviceIdentity,
} from "../../../functions/lib/connection-identity";
import { sendTransactionalEmail } from "../../../functions/lib/transactional-email";

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
  NOXSPOT_EMAIL_FROM?: string;
}

export default class NoxConnectCapabilities extends WorkerEntrypoint<Env> {
  async execute(command: unknown) {
    return await executeConnectionCapability(this.env, command);
  }

  async exchangeGitHubOAuth(input: unknown) {
    return await exchangeGitHubOAuthIdentity(this.env, input);
  }

  async refreshGitHubIdentity(input: unknown) {
    return await refreshGitHubIdentity(this.env, input);
  }

  async startGitHubDeviceAuth(input: unknown) {
    return await startGitHubDeviceIdentity(this.env, input);
  }

  async pollGitHubDeviceAuth(input: unknown) {
    return await pollGitHubDeviceIdentity(this.env, input);
  }

  async sendEmail(input: unknown) {
    return await sendTransactionalEmail(this.env, input);
  }

  fetch(): Response {
    return Response.json({ error: "private_service" }, { status: 404 });
  }
}
