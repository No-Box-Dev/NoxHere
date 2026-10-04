import { describe, expect, it } from "vitest";
import { onRequestGet } from "../v1/projects/[id]/cue/dashboard";

describe("NoxCue project dashboard", () => {
  it("uses the project's editable engagement timeframe", async () => {
    const queries: string[] = [];
    const bindings: unknown[][] = [];
    const db = {
      prepare(sql: string) {
        queries.push(sql);
        const statement = {
          bind(...values: unknown[]) { bindings.push(values); return statement; },
          async first() { return sql.includes("cue_engagement_settings") ? { window_days: 14 } : null; },
          async all() {
            if (sql.includes("WITH RECURSIVE periods")) return { results: [
              { period: "2026-10-02", metric_key: "custom.comments.written", label: "Comments written", daily_events: 4, weekly_events: 80, weekly_active: 20, weekly_participants: 8, previous_weekly_events: 60, previous_weekly_active: 20 },
              { period: "2026-10-03", metric_key: "custom.comments.written", label: "Comments written", daily_events: 6, weekly_events: 100, weekly_active: 20, weekly_participants: 10, previous_weekly_events: 80, previous_weekly_active: 20 },
            ] };
            return { results: [] };
          },
        };
        return statement;
      },
    };

    const response = await onRequestGet({
      env: { DB: db },
      request: new Request("https://app.noxhere.com/api/v1/projects/playnist/cue/dashboard?range=30d"),
      params: { id: "playnist" },
      data: { orgId: 7, projectId: "playnist" },
    } as never);
    const body = await response.json() as { stats: Array<{ id: string; name: string; value: string; context: string; points: number[] }> };

    expect(queries.find((sql) => sql.includes("FROM cue_daily_metrics"))).toContain("metric.metric_key NOT LIKE 'custom.%'");
    const customSql = queries.find((sql) => sql.includes("WITH RECURSIVE periods")) ?? "";
    expect(customSql).toContain("activity.period BETWEEN date(periods.period, ?) AND periods.period");
    expect(customSql).toContain("COUNT(DISTINCT active.subject_hash)");
    expect(bindings.some((values) => values.includes("-13 days") && values.includes("-27 days") && values.includes("-14 days"))).toBe(true);
    expect(body.stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "custom.comments.written", name: "Comments written", value: "6", points: [4, 6] }),
      expect.objectContaining({
        id: "custom.comments.written.per_mau",
        name: "Comments per active user",
        value: "5.00",
        context: "Last 14 days",
        change: "↑ 25.0% vs previous 14 days",
        points: [4, 5],
        breakdown: {
          actionLabel: "comments",
          windowDays: 14,
          totalActions: 100,
          activeUsers: 20,
          participatingUsers: 10,
          participationRate: 0.5,
          actionsPerParticipant: 10,
        },
      }),
    ]));
  });
});
