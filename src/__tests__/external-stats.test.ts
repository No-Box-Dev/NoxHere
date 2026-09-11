import { describe, expect, it, vi } from "vitest";
import { appleAnalyticsBatchSchema, ingestAppleAnalyticsBatch } from "../external-stats";

const validBatch = {
  version: 1,
  provider: "apple-app-store-connect",
  organizationId: 7,
  sourceId: "source-1",
  batchId: "instance-123",
  values: [{
    period: "2026-09-09",
    metrics: { "apple.downloads.total": 12, "apple.sessions": 42 },
  }],
} as const;

describe("Apple analytics batch validation", () => {
  it("accepts only governed Apple metrics", () => {
    expect(appleAnalyticsBatchSchema.parse(validBatch)).toEqual(validBatch);
    expect(() => appleAnalyticsBatchSchema.parse({
      ...validBatch,
      values: [{ period: "2026-09-09", metrics: { "users.active.daily": 42 } }],
    })).toThrow();
  });
});

describe("Apple analytics batch ingestion", () => {
  it("replaces a batch and rebuilds every affected rollup atomically", async () => {
    const boundStatements: Array<{ sql: string; values: unknown[] }> = [];
    const prepare = vi.fn((sql: string) => {
      const entry = { sql, values: [] as unknown[] };
      const statement = {
        bind: vi.fn((...values: unknown[]) => {
          entry.values = values;
          boundStatements.push(entry);
          return statement;
        }),
        first: vi.fn(async () => ({ id: "source-1" })),
        all: vi.fn(async () => ({
          results: [{ period: "2026-09-08", metric_key: "apple.crashes" }],
        })),
      };
      return statement;
    });
    const batch = vi.fn(async (_statements: D1PreparedStatement[]) => []);

    await expect(ingestAppleAnalyticsBatch({ prepare, batch } as unknown as D1Database, validBatch))
      .resolves.toEqual({ ok: true, affectedMetrics: 3 });

    expect(batch).toHaveBeenCalledOnce();
    expect(boundStatements.some(({ sql, values }) =>
      sql.includes("INSERT INTO cue_external_metric_contributions") && values.includes("instance-123"),
    )).toBe(true);
    expect(boundStatements.filter(({ sql }) => sql.includes("DELETE FROM cue_daily_metrics"))).toHaveLength(1);
    expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
  });
});
