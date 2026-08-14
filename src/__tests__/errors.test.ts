import { describe, expect, it } from "vitest";
import {
  browserErrorSchema,
  buildErrorSlackMessage,
  errorFilterSchema,
  fingerprintError,
  isProjectOriginAllowed,
  matchesErrorFilter,
  projectErrorSettingsSchema,
} from "../errors";

const error = browserErrorSchema.parse({
  version: 1,
  service: "n1-care-frontend",
  environment: "production",
  release: "2026.08.14",
  error: {
    type: "TypeError",
    message: "Cannot read order 12345",
    stack: "TypeError: Cannot read order 12345\n    at Checkout (/src/checkout.tsx:42:7)",
  },
  page: { url: "https://n1.care/checkout", route: "/checkout" },
});

describe("browser error ingestion", () => {
  it("accepts the bounded v1 browser-error contract", () => {
    expect(error.service).toBe("n1-care-frontend");
    expect(() => browserErrorSchema.parse({ ...error, unexpected: true })).toThrow();
  });

  it("supports safe include and exclude filters without regex or SQL", () => {
    const filter = errorFilterSchema.parse({
      environments: ["production"],
      services: ["n1-care-frontend"],
      include: [{ field: "page.route", operator: "starts_with", value: "/check" }],
      exclude: [{ field: "error.message", operator: "contains", value: "ResizeObserver" }],
    });
    expect(matchesErrorFilter(error, filter)).toBe(true);
    expect(matchesErrorFilter(error, {
      ...filter,
      exclude: [{ field: "error.type", operator: "equals", value: "TypeError" }],
    })).toBe(false);
  });

  it("normalizes changing IDs into one stable fingerprint", async () => {
    const first = await fingerprintError(error, "rule-1");
    const second = await fingerprintError({
      ...error,
      error: { ...error.error, message: "Cannot read order 98765" },
    }, "rule-1");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("requires exact configured browser origins", () => {
    expect(isProjectOriginAllowed("https://n1.care", ["https://n1.care"])).toBe(true);
    expect(isProjectOriginAllowed("https://evil.example", ["https://n1.care"])).toBe(false);
    expect(isProjectOriginAllowed(null, [])).toBe(true);
    expect(projectErrorSettingsSchema.safeParse({
      enabled: true,
      allowedOrigins: ["https://n1.care/path"],
    }).success).toBe(false);
  });

  it("builds a concise escaped Slack notification", () => {
    const message = buildErrorSlackMessage(error, { name: "Frontend errors" }, 17, "a".repeat(64));
    expect(message).toContain("NoxAlert — Frontend errors");
    expect(message).toContain("Occurrences:* 17");
    expect(message).toContain("n1-care-frontend");
  });
});
