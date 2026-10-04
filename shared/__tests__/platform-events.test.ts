import { describe, expect, it } from "vitest";
import {
  MAX_PLATFORM_EVENT_BYTES,
  PLATFORM_EVENT_TYPES,
  PlatformEventSchema,
  findForbiddenEventPaths,
  parsePlatformEvent,
} from "../platform-events";

const HASH = `sha256:${"a".repeat(64)}`;

function base(type: string, data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    specVersion: 1,
    dataVersion: 1,
    id: "550e8400-e29b-41d4-a716-446655440000",
    type,
    orgId: 7,
    projectId: "project-1",
    source: { component: "browser_sdk", sourceId: "production-web" },
    subject: { type: "feedback_report", id: "report-1" },
    actor: { type: "system" },
    context: { environment: "production", release: "2026.10.4" },
    message: { title: "Example event", severity: "info" },
    occurredAt: "2026-10-04T10:15:00Z",
    idempotencyKey: `${type}:1`,
    correlationId: "correlation-1",
    data,
    ...overrides,
  };
}

const fixtures: Record<string, ReturnType<typeof base>> = {
  "source_control.pull_request.opened": base("source_control.pull_request.opened", {
    repository: "store", number: 42, title: "Fix checkout", url: "https://github.com/acme/store/pull/42",
    baseBranch: "main", headBranch: "fix-checkout",
  }),
  "source_control.pull_request.merged": base("source_control.pull_request.merged", {
    repository: "store", number: 42, title: "Fix checkout", url: "https://github.com/acme/store/pull/42",
    baseBranch: "main", headBranch: "fix-checkout", additions: 12, deletions: 4, changedFiles: 2,
  }),
  "source_control.issue.created": base("source_control.issue.created", {
    repository: "store", number: 51, title: "Checkout timeout", url: "https://github.com/acme/store/issues/51",
    labels: ["bug"],
  }),
  "feedback.report.created": base("feedback.report.created", {
    category: "bug", description: "Pay does not respond", screenshotAssetId: "asset-1", notificationRequested: true,
  }),
  "feedback.report.reopened": base("feedback.report.reopened", {
    reason: "The reporter can still reproduce it", responseId: "response-1",
  }),
  "feedback.report.resolved": base("feedback.report.resolved", {
    summary: "The checkout request now completes", resolutionSource: "source_control", externalIssueNumber: 51,
  }),
  "reliability.error.detected": base("reliability.error.detected", {
    fingerprint: "checkout-timeout", errorCode: "CHECKOUT_TIMEOUT", component: "payment_form",
    fatal: false, unhandled: true, sanitizedError: { name: "TimeoutError", message: "Request timed out" },
    attributes: { region: "eu", attempts: 2 },
  }),
  "reliability.incident.opened": base("reliability.incident.opened", {
    incidentKey: "checkout-timeout", category: "error", impact: "Checkout attempts are failing", occurrenceCount: 3,
  }),
  "reliability.incident.resolved": base("reliability.incident.resolved", {
    incidentKey: "checkout-timeout", resolution: "The dependency recovered", durationMs: 120_000,
  }),
  "engagement.user.registered": base("engagement.user.registered", {}, {
    subject: { type: "user", id: HASH }, actor: { type: "anonymous", idHash: HASH },
  }),
  "engagement.user.active": base("engagement.user.active", {}, {
    subject: { type: "user", id: HASH }, actor: { type: "anonymous", idHash: HASH },
  }),
  "engagement.activity.recorded": base("engagement.activity.recorded", {
    metric: "custom.checkout.completed", value: 1, attributes: { plan: "team" },
  }, { subject: { type: "user", id: HASH }, actor: { type: "anonymous", idHash: HASH } }),
  "capability.execution.completed": base("capability.execution.completed", {
    capability: "feedback.resolve", outcome: "success", durationMs: 120,
  }),
  "delivery.notification.queued": base("delivery.notification.queued", {
    commandId: "command-1", provider: "slack", operation: "message.send", route: "feedback",
  }),
  "delivery.notification.delivered": base("delivery.notification.delivered", {
    commandId: "command-1", provider: "github", operation: "issue.create", route: "feedback", attempts: 1,
    providerReference: { resourceType: "issue", resourceId: "51", url: "https://github.com/acme/store/issues/51" },
  }),
  "delivery.notification.failed": base("delivery.notification.failed", {
    commandId: "command-1", provider: "email", operation: "message.send", route: "feedback",
    errorCode: "PROVIDER_UNAVAILABLE", retryable: true, attempts: 2,
  }),
};

describe("PlatformEventV1", () => {
  it("has a valid fixture for every registered event type", () => {
    expect(Object.keys(fixtures).sort()).toEqual([...PLATFORM_EVENT_TYPES].sort());
    for (const type of PLATFORM_EVENT_TYPES) {
      expect(parsePlatformEvent(fixtures[type]).type).toBe(type);
    }
  });

  it("uses type as the discriminator and rejects unknown types", () => {
    expect(() => parsePlatformEvent(base("feedback.unknown", {}))).toThrow();
  });

  it("allows type-specific fields only inside data", () => {
    const valid = fixtures["feedback.report.created"];
    expect(parsePlatformEvent(valid).data).toMatchObject({ category: "bug" });
    expect(() => parsePlatformEvent({ ...valid, category: "bug" })).toThrow();
    expect(() => parsePlatformEvent({ ...valid, data: { ...valid.data, incidentKey: "unexpected" } })).toThrow();
  });

  it("requires valid organization and project tenancy", () => {
    const valid = fixtures["feedback.report.created"];
    expect(() => parsePlatformEvent({ ...valid, orgId: 0 })).toThrow();
    expect(() => parsePlatformEvent({ ...valid, projectId: "" })).toThrow();
  });

  it("versions the envelope and event data independently", () => {
    const valid = fixtures["feedback.report.created"];
    expect(() => parsePlatformEvent({ ...valid, specVersion: 2 })).toThrow();
    expect(() => parsePlatformEvent({ ...valid, dataVersion: 2 })).toThrow();
  });

  it("requires timestamps with an explicit UTC offset", () => {
    const valid = fixtures["feedback.report.created"];
    expect(() => parsePlatformEvent({ ...valid, occurredAt: "2026-10-04T10:15:00" })).toThrow();
  });

  it("rejects credential-shaped fields at any depth", () => {
    const unsafe = {
      ...fixtures["reliability.error.detected"],
      data: { ...fixtures["reliability.error.detected"].data, attributes: { apiKey: "leaked" } },
    };
    expect(findForbiddenEventPaths(unsafe)).toEqual(["$.data.attributes.apiKey"]);
    expect(() => parsePlatformEvent(unsafe)).toThrow("cannot contain credentials");
  });

  it("rejects direct email and user identifiers", () => {
    const valid = fixtures["feedback.report.created"];
    expect(() => parsePlatformEvent({ ...valid, data: { ...valid.data, reporterEmail: "person@example.com" } }))
      .toThrow("direct private identities");
    expect(() => parsePlatformEvent({ ...fixtures["engagement.user.active"], data: { userId: "person-1" } }))
      .toThrow("direct private identities");
  });

  it("accepts hashed anonymous identities and rejects unhashed engagement subjects", () => {
    expect(parsePlatformEvent(fixtures["engagement.user.active"]).subject.id).toBe(HASH);
    expect(() => parsePlatformEvent({
      ...fixtures["engagement.user.active"],
      subject: { type: "user", id: "raw-user-id" },
    })).toThrow("Engagement subjects must use a sha256: identity");
    expect(() => parsePlatformEvent({
      ...fixtures["engagement.user.active"],
      actor: { type: "anonymous", id: "raw-user-id" },
    })).toThrow();
  });

  it("rejects an otherwise valid event above the byte limit", () => {
    const attributes = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`attribute_${index}`, "x".repeat(700)]),
    );
    const oversized = {
      ...fixtures["reliability.error.detected"],
      data: { ...fixtures["reliability.error.detected"].data, attributes },
    };
    expect(new TextEncoder().encode(JSON.stringify(oversized)).byteLength).toBeGreaterThan(MAX_PLATFORM_EVENT_BYTES);
    expect(() => parsePlatformEvent(oversized)).toThrow(`exceeds ${MAX_PLATFORM_EVENT_BYTES} bytes`);
  });

  it("exports a strict schema for callers that already performed boundary checks", () => {
    expect(PlatformEventSchema.safeParse(fixtures["delivery.notification.delivered"]).success).toBe(true);
  });
});
