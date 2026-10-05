import { beforeEach, describe, expect, it, vi } from "vitest";

const publish = vi.hoisted(() => vi.fn().mockResolvedValue({ queued: true }));
vi.mock("../platform-event-store", () => ({ publishPlatformEvent: publish }));
import { recoverTransportDeliveryEvents } from "../transport-delivery-events";

const command = {
  contract: "platform.transport-command", version: 1, commandId: "transport-1", idempotencyKey: "incident:1",
  orgId: 7, projectId: "project-1", route: "incidents", requestedAt: "2026-10-04T10:00:00Z",
  operation: "github.issue.create", input: { issue: { title: "Incident", body: "Details", labels: [] } },
};
const receipt = {
  contract: "platform.transport-receipt", version: 1, commandId: "transport-1", idempotencyKey: "incident:1",
  operation: "github.issue.create", provider: "github", status: "delivered", attempts: 1,
  recordedAt: "2026-10-04T10:01:00Z", result: { resourceType: "issue", resourceId: "42", url: "https://github.com/acme/app/issues/42" },
};

beforeEach(() => vi.clearAllMocks());

describe("transport delivery events", () => {
  it("recovers both queued and terminal canonical events from a delivered outbox row", async () => {
    const db = { prepare: () => { const statement = {
      bind: () => statement,
      all: async () => ({ results: [{
        id: "transport-1", org_id: 7, project_id: "project-1", provider: "github",
        operation: "github.issue.create", route: "incidents", command_json: JSON.stringify(command),
        status: "delivered", receipt_json: JSON.stringify(receipt), created_at: "2026-10-04T10:00:00Z",
        updated_at: "2026-10-04T10:01:00Z", queued_event_exists: 0, terminal_event_exists: 0,
      }] }),
    }; return statement; } };
    const env = { DB: db as unknown as D1Database, TASK_QUEUE: {} as Queue };
    await expect(recoverTransportDeliveryEvents(env)).resolves.toEqual({ found: 1, published: 2 });
    expect(publish).toHaveBeenNthCalledWith(1, env, expect.objectContaining({ type: "delivery.notification.queued" }));
    expect(publish).toHaveBeenNthCalledWith(2, env, expect.objectContaining({
      type: "delivery.notification.delivered",
      data: expect.objectContaining({ providerReference: expect.objectContaining({ resourceId: "42" }) }),
    }));
  });
});
