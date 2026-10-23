import { describe, expect, it, vi } from "vitest";
import { planningReadiness } from "../health";

describe("Planning health", () => {
  it("requires D1 schema and attachment storage", async () => {
    const first = vi.fn(async () => null);
    const response = await planningReadiness({
      DB: { prepare: vi.fn(() => ({ first })) } as unknown as D1Database,
      SPEC_ATTACHMENTS: {} as R2Bucket,
      BUILD_SHA: "development",
    });
    expect(response.status).toBe(200);
    expect(first).toHaveBeenCalledTimes(3);
    await expect(response.json()).resolves.toMatchObject({
      service: "planning",
      kind: "readiness",
      buildSha: "development",
      checks: { database: true, schemaV3: true, attachments: true },
    });
  });
});
