import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../telemetry/events";

describe("Telemetry event delivery receipts", () => {
  it("reads Slack delivery state from the unified transport outbox", async () => {
    let query = "";
    const context = {
      request: new Request("https://app.noxhere.com/api/telemetry/events?sourceId=11111111-1111-4111-8111-111111111111"),
      data: { orgId: 7, projectId: "project-1" },
      env: {
        DB: {
          prepare: vi.fn((sql: string) => {
            query = sql;
            return {
              bind: vi.fn(() => ({
                all: vi.fn(async () => ({
                  results: [{
                    delivery_id: "telemetry-event-1",
                    type: "error.occurred",
                    summary: "Acceptance error",
                    payload_json: JSON.stringify({ sourceId: "11111111-1111-4111-8111-111111111111" }),
                    created_at: "2026-10-16T16:31:01.000Z",
                    delivery_status: "delivered",
                    delivered_at: "2026-10-16T16:31:06.000Z",
                  }],
                })),
              })),
            };
          }),
        } as unknown as D1Database,
      },
    };

    const response = await onRequestGet(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      events: [{ id: "telemetry-event-1", deliveryStatus: "delivered" }],
    });
    expect(query).toContain("LEFT JOIN transport_outbox delivery");
    expect(query).toContain("delivery.idempotency_key = 'telemetry:error:' || event.delivery_id");
    expect(query).not.toContain("LEFT JOIN delivery_outbox delivery");
  });
});
