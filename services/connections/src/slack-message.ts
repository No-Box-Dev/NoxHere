import {
  deliverResolvedSlackMessage,
  type SlackMessagePayload,
} from "../../../functions/lib/transports/slack";
import { resolveSlackDestination } from "./slack-destination";

interface SlackMessageEnvironment {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SLACK_APP_ID?: string;
}

export async function sendSlackMessage(env: SlackMessageEnvironment, input: unknown) {
  const candidate = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const orgId = Number(candidate.orgId);
  const projectId = typeof candidate.projectId === "string" && candidate.projectId.trim()
    ? candidate.projectId.trim()
    : null;
  const connectionId = typeof candidate.connectionId === "string" ? candidate.connectionId.trim() : "";
  const channelId = typeof candidate.channelId === "string" ? candidate.channelId.trim() : "";
  const message = candidate.message && typeof candidate.message === "object" && !Array.isArray(candidate.message)
    ? candidate.message as SlackMessagePayload
    : null;
  if (!Number.isSafeInteger(orgId) || orgId < 1 || !connectionId || !channelId || !message) {
    return { ok: false as const, error: { code: "invalid_request", message: "Slack delivery input is invalid" } };
  }

  const destination = await resolveSlackDestination(env, { orgId, projectId, connectionId, channelId });
  if (!destination.ok) return destination;

  try {
    const receipt = await deliverResolvedSlackMessage(env, { orgId, connectionId, channelId, message });
    return { ok: true as const, result: { connectionId: destination.install.id, ...receipt } };
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
