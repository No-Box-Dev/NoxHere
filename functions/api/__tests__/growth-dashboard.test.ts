import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../v1/projects/[id]/growth/dashboard";

describe("Growth dashboard", () => {
  it("returns unique funnel counts and acquisition breakdowns", async () => {
    const prepare = vi.fn(() => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    });
    const batch = vi.fn(async () => [
      { results: [{ name: "website.page_visited", value: 12 }, { name: "subscription.paid_started", value: 3 }] },
      { results: [{ label: "Organic search", visitors: 8, trials: 4, paid: 3, revenueMinor: 8700, currency: "USD" }] },
      { results: [] },
      { results: [] },
    ]);
    const response = await onRequestGet({
      env: { DB: { prepare, batch } as unknown as D1Database },
      request: new Request("https://app.noxhere.com/api/v1/projects/noxhere/growth/dashboard?range=30d"),
      params: { id: "noxhere" },
      data: { orgId: 2, projectId: "noxhere" },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { funnel: { visits: number; paid: number }; acquisition: { channels: Array<{ revenueMinor: number }> } };
    expect(body.funnel).toMatchObject({ visits: 12, paid: 3 });
    expect(body.acquisition.channels[0]).toMatchObject({ revenueMinor: 8700 });
    expect(batch).toHaveBeenCalledOnce();
  });

  it("supports an unbounded all-time range", async () => {
    const queries: string[] = [];
    const prepare = vi.fn((sql: string) => {
      queries.push(sql);
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => ({ day: "2026-01-01" })),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    });
    const response = await onRequestGet({
      env: { DB: { prepare, batch: vi.fn(async () => [{ results: [] }, { results: [] }, { results: [] }, { results: [] }]) } as unknown as D1Database },
      request: new Request("https://app.noxhere.com/api/v1/projects/noxhere/growth/dashboard?range=all"),
      params: { id: "noxhere" },
      data: { orgId: 2, projectId: "noxhere" },
    });
    expect((await response.json() as { range: string }).range).toBe("all");
    expect(queries.some((sql) => sql.includes("SELECT MIN(day)"))).toBe(true);
    expect(queries.filter((sql) => sql.includes("FROM growth_event_dimensions") && sql.includes("GROUP BY")).every((sql) => !sql.includes("occurred_at >="))).toBe(true);
  });
});
