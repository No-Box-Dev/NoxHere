import { z } from "zod";

export const CANARY_SOURCE = "noxalert_canary";
const MAX_BODY_BYTES = 4_096;

export const canaryInputSchema = z.object({
  service: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(240),
});

export interface CanaryDeliveryStatus {
  id: string;
  status: string;
  attemptCount: number;
  errorCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface NoxSlackDeliveryTask {
  type: "deliver_slack";
  outboxId: string;
  ownerId: string;
  deliveryId: string;
}

export class CanaryRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ") || !secret) return false;
  const supplied = new TextEncoder().encode(header.slice(7));
  const expected = new TextEncoder().encode(secret);
  return supplied.byteLength === expected.byteLength
    && crypto.subtle.timingSafeEqual(supplied, expected);
}

export async function readCanaryInput(request: Request): Promise<z.infer<typeof canaryInputSchema>> {
  if (!request.body) throw new CanaryRequestError("A JSON body is required", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new CanaryRequestError("Request body is too large", 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return canaryInputSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CanaryRequestError("Invalid canary event", 400);
    }
    throw new CanaryRequestError("Malformed JSON", 400);
  }
}

function slackEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildSlackMessage(input: z.infer<typeof canaryInputSchema>, deliveryId: string): string {
  const service = slackEscape(input.service.replaceAll(/\s+/g, " "));
  const message = slackEscape(input.message.replaceAll(/\s+/g, " "));
  return [
    ":rotating_light: *NoxAlert Canary — Synthetic Error*",
    `*Service:* \`${service}\``,
    `*Error:* ${message}`,
    "*Environment:* `production`",
    `*Delivery:* \`${deliveryId}\``,
    "_Generated intentionally from the NoxAlert mock error page._",
  ].join("\n");
}

/** Shared Unticket outbox contract: `message` is the chat.postMessage body. */
export function buildSlackPayload(input: z.infer<typeof canaryInputSchema>, deliveryId: string) {
  return {
    message: {
      text: buildSlackMessage(input, deliveryId),
    },
  };
}

export function normalizeSlackPayload(value: unknown): { message: Record<string, unknown> & { text: string } } | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return { message: { text: message } };
  if (!message || typeof message !== "object") return null;
  const text = (message as { text?: unknown }).text;
  if (typeof text !== "string" || !text.trim()) return null;
  return { message: message as Record<string, unknown> & { text: string } };
}
