import { describe, expect, it } from "vitest";
import { livenessResponse, readinessResponse } from "./health";

describe("health contracts", () => {
  it("keeps liveness dependency-free and non-cacheable", async () => {
    const response = livenessResponse("example", "abc123");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      contractVersion: 1,
      kind: "liveness",
      service: "example",
      status: "ok",
      buildSha: "abc123",
    });
  });

  it("fails readiness when any dependency is unavailable", async () => {
    const response = readinessResponse("example", "abc123", { database: true, provider: false });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      kind: "readiness",
      status: "not_ready",
      checks: { database: true, provider: false },
    });
  });
});
