import { describe, expect, it, vi } from "vitest";
import { activityReadiness } from "./health.js";

describe("Activity health", () => {
  it("checks the schema used by activity reads", async () => {
    const prepare = vi.fn(() => ({ first: vi.fn(async () => null) }));
    const response = await activityReadiness({ DEMO_DB: { prepare }, BUILD_SHA: "release-1" });

    expect(response.status).toBe(200);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("payload_json"));
    await expect(response.json()).resolves.toMatchObject({
      service: "activity", kind: "readiness", buildSha: "release-1", checks: { database: true },
    });
  });

  it("does not claim readiness when D1 is unavailable", async () => {
    const response = await activityReadiness({
      DEMO_DB: { prepare: () => ({ first: async () => { throw new Error("offline"); } }) },
      BUILD_SHA: "release-1",
    });
    expect(response.status).toBe(503);
  });
});
