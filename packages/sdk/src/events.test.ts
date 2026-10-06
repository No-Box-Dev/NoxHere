import { describe, expect, it } from "vitest";
import { parsePlatformEvent } from "../../contracts/platform-events.js";
import { createPlatformEvent, PLATFORM_EVENT_TYPES } from "./events.js";

describe("platform event SDK helper", () => {
  it("builds an envelope accepted by the canonical contract", () => {
    const event = createPlatformEvent({
      id: "e835cd8f-f73a-4206-a67d-11df7d3f60d7",
      type: "feedback.report.created",
      orgId: 7,
      projectId: "project-1",
      source: { component: "feedback.widget", sourceId: "site-1" },
      subject: { type: "feedback_report", id: "report-1" },
      occurredAt: "2026-10-06T12:00:00.000Z",
      idempotencyKey: "feedback:report-1:created",
      data: { category: "bug", description: "The button is obscured", notificationRequested: false },
    });

    expect(parsePlatformEvent(event)).toEqual(event);
    expect(event.specVersion).toBe(1);
    expect(event.dataVersion).toBe(1);
  });

  it("generates every registered event type from the canonical source", () => {
    expect(PLATFORM_EVENT_TYPES).toContain("delivery.notification.delivered");
    expect(new Set(PLATFORM_EVENT_TYPES).size).toBe(PLATFORM_EVENT_TYPES.length);
  });

  it("rejects private identity fields and oversized custom data", () => {
    const base = {
      id: "e835cd8f-f73a-4206-a67d-11df7d3f60d7",
      type: "feedback.report.created" as const,
      orgId: 7,
      projectId: "project-1",
      source: { component: "feedback.widget" },
      subject: { type: "feedback_report", id: "report-1" },
      idempotencyKey: "feedback:report-1:created",
    };
    expect(() => createPlatformEvent({ ...base, data: { email: "private@example.com" } })).toThrow(/private identities/);
    expect(() => createPlatformEvent({ ...base, data: { description: "x".repeat(65_000) } })).toThrow(/exceeds/);
  });
});
