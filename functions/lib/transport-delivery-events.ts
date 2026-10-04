import { parseTransportCommand, parseTransportReceipt, type TransportReceipt } from "../../shared/transport-commands";
import { publishPlatformEvent } from "./platform-event-store";

interface DeliveryRow {
  id: string;
  org_id: number;
  project_id: string;
  provider: "slack" | "github";
  operation: string;
  route: string;
  command_json: string;
  status: string;
  receipt_json: string | null;
  created_at: string;
  updated_at: string;
  queued_event_exists: number;
  terminal_event_exists: number;
}

function providerReference(receipt: TransportReceipt) {
  if (receipt.provider === "slack" && receipt.result) {
    return { resourceType: "message", resourceId: `${receipt.result.channelId}:${receipt.result.messageId}` };
  }
  if (receipt.provider === "github" && receipt.result) {
    return {
      resourceType: receipt.result.resourceType,
      resourceId: receipt.result.resourceId,
      ...(receipt.result.url ? { url: receipt.result.url } : {}),
    };
  }
  throw new Error("Delivered transport receipt has no provider reference");
}

async function publishLifecycleEvent(env: Pick<Env, "DB" | "TASK_QUEUE">, row: DeliveryRow, phase: "queued" | "terminal") {
  const command = parseTransportCommand(JSON.parse(row.command_json));
  const receipt = row.receipt_json ? parseTransportReceipt(JSON.parse(row.receipt_json)) : null;
  const terminalType = receipt?.status === "delivered" ? "delivery.notification.delivered" : "delivery.notification.failed";
  const type = phase === "queued" ? "delivery.notification.queued" : terminalType;
  const occurredAt = phase === "queued" ? row.created_at : (receipt?.recordedAt ?? row.updated_at);
  const base = { commandId: row.id, provider: row.provider, operation: row.operation, route: row.route };
  const data = phase === "queued"
    ? base
    : receipt?.status === "delivered"
      ? { ...base, providerReference: providerReference(receipt), attempts: Math.max(receipt.attempts, 1) }
      : {
          ...base,
          errorCode: receipt?.error?.code ?? "transport_failed",
          retryable: receipt?.error?.retryable ?? false,
          attempts: Math.max(receipt?.attempts ?? 0, 1),
        };
  return publishPlatformEvent(env, {
    specVersion: 1, dataVersion: 1, id: crypto.randomUUID(), type,
    orgId: row.org_id, projectId: row.project_id,
    source: { component: "transport.outbox", sourceId: row.id },
    subject: { type: "transport.command", id: row.id }, actor: { type: "system" },
    message: { title: phase === "queued" ? `Queued ${command.operation}` : `${receipt?.status ?? "failed"} ${command.operation}` },
    occurredAt, idempotencyKey: `transport:${row.id}:${phase === "queued" ? "queued" : receipt?.status ?? "failed"}`,
    correlationId: command.correlationId ?? row.id,
    ...(command.causedByEventId ? { causationId: command.causedByEventId } : {}),
    data,
  });
}

export async function recoverTransportDeliveryEvents(
  env: Pick<Env, "DB" | "TASK_QUEUE">,
  options: { limit?: number } = {},
): Promise<{ found: number; published: number }> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const { results } = await env.DB.prepare(
    `SELECT transport.id, transport.org_id, transport.project_id, transport.provider,
            transport.operation, transport.route, transport.command_json, transport.status,
            transport.receipt_json, transport.created_at, transport.updated_at,
            EXISTS(SELECT 1 FROM platform_events event
                    WHERE event.source_component = 'transport.outbox' AND event.source_id = transport.id
                      AND event.type = 'delivery.notification.queued') AS queued_event_exists,
            EXISTS(SELECT 1 FROM platform_events event
                    WHERE event.source_component = 'transport.outbox' AND event.source_id = transport.id
                      AND event.type IN ('delivery.notification.delivered', 'delivery.notification.failed')) AS terminal_event_exists
       FROM transport_outbox transport
      WHERE NOT EXISTS(SELECT 1 FROM platform_events event
                        WHERE event.source_component = 'transport.outbox' AND event.source_id = transport.id
                          AND event.type = 'delivery.notification.queued')
         OR (transport.status IN ('delivered', 'blocked', 'failed') AND NOT EXISTS(
              SELECT 1 FROM platform_events event
               WHERE event.source_component = 'transport.outbox' AND event.source_id = transport.id
                 AND event.type IN ('delivery.notification.delivered', 'delivery.notification.failed')))
      ORDER BY transport.created_at, transport.id LIMIT ?`,
  ).bind(limit).all<DeliveryRow>();
  let published = 0;
  for (const row of results ?? []) {
    if (!Number(row.queued_event_exists)) {
      await publishLifecycleEvent(env, row, "queued");
      published += 1;
    }
    if (["delivered", "blocked", "failed"].includes(row.status) && !Number(row.terminal_event_exists)) {
      await publishLifecycleEvent(env, row, "terminal");
      published += 1;
    }
  }
  return { found: results?.length ?? 0, published };
}
