import { describe, expect, it, vi } from "vitest";
import { telemetryReadiness } from "../health";

describe("Telemetry health", () => {
  it("requires its database schema and delivery queue for readiness", async () => {
    const response = await telemetryReadiness({
      NOX_DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => null) })) } as unknown as D1Database,
      NOX_TASKS: {} as Queue,
      BUILD_SHA: "development",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: "telemetry",
      kind: "readiness",
      buildSha: "development",
      checks: { database: true, taskQueue: true },
    });
  });

  it("fails closed without the expected schema", async () => {
    const response = await telemetryReadiness({
      NOX_DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => { throw new Error("missing table"); }) })) } as unknown as D1Database,
      NOX_TASKS: {} as Queue,
      BUILD_SHA: "development",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "not_ready", checks: { database: false } });
  });
});
