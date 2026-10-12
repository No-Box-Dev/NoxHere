import { describe, expect, it } from "vitest";
import { compatibilityApiPath } from "../api-paths.js";

describe("canonical API paths", () => {
  it("maps v1 resources onto compatibility handlers", () => {
    expect(compatibilityApiPath("/api/v1/features/12")).toBe("/api/features/12");
    expect(compatibilityApiPath("/api/v1/telemetry/sources/source-1/keys")).toBe(
      "/api/telemetry/sources/source-1/keys",
    );
    expect(compatibilityApiPath("/api/v1/projects/project-1/routing")).toBe(
      "/api/projects/routing/project-1",
    );
    expect(compatibilityApiPath("/api/v1/telemetry/public/events")).toBe(
      "/api/telemetry/public/v1/events",
    );
  });

  it("does not rewrite routes that were born in API v1", () => {
    expect(compatibilityApiPath("/api/v1/services/telemetry/health")).toBe(
      "/api/v1/services/telemetry/health",
    );
    expect(compatibilityApiPath("/api/v1/activity")).toBe("/api/v1/activity");
  });
});
