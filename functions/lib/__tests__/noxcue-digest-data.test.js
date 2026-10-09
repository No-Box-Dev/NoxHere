import { describe, expect, it } from "vitest";
import { completedPeriodAt, storeNoxCueDerivedMetrics, summarizeNoxCueDigestRows } from "../noxcue-digest-data.js";

describe("NoxCue digest history", () => {
  it("persists only catalogued metrics so catalog drift cannot block delivery", async () => {
    const statements = [];
    const db = {
      prepare(sql) {
        const statement = {
          sql,
          args: [],
          bind(...args) { this.args = args; return this; },
        };
        statements.push(statement);
        return statement;
      },
      async batch(batch) { return batch.map(() => ({ success: true })); },
    };

    await storeNoxCueDerivedMetrics(db, 2, "playnist", "2026-10-08", {
      "users.active.daily": 0,
      "future.metric": 1,
      "custom.journals": 2,
    });

    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("FROM cue_metric_definitions definition");
    expect(statements[0].sql).toContain("WHERE definition.key = ?");
    expect(statements[1].args.at(-1)).toBe("future.metric");
  });

  it("selects the previous completed day in the source timezone", () => {
    expect(completedPeriodAt("Asia/Kuala_Lumpur", new Date("2026-08-29T16:30:00Z")))
      .toBe("2026-08-29");
  });
  it("compares the current value to the exact previous day and preceding 30 stored days", () => {
    const summary = summarizeNoxCueDigestRows([
      { period: "2026-07-30", metric_key: "users.new", value: 4, origin: "reported" },
      { period: "2026-08-27", metric_key: "users.new", value: 8, origin: "reported" },
      { period: "2026-08-28", metric_key: "users.new", value: 10, origin: "reported" },
      { period: "2026-08-29", metric_key: "users.new", value: 12, origin: "reported" },
      { period: "2026-08-29", metric_key: "users.stickiness.dau_mau", value: 0.25, origin: "calculated" },
    ], "2026-08-29");

    expect(summary).toEqual({
      metrics: { "users.new": 12, "users.stickiness.dau_mau": 0.25 },
      comparisons: {
        "users.new": {
          yesterday: 10,
          average30d: 22 / 3,
          sampleDays: 3,
          history: [
            { period: "2026-07-30", value: 4 },
            { period: "2026-08-27", value: 8 },
            { period: "2026-08-28", value: 10 },
            { period: "2026-08-29", value: 12 },
          ],
        },
        "users.stickiness.dau_mau": {
          yesterday: null,
          average30d: null,
          sampleDays: 0,
          history: [{ period: "2026-08-29", value: 0.25 }],
        },
      },
      hasData: true,
      hasReportedData: true,
    });
  });

  it("derives the standard user suite from closed registration and activity facts", async () => {
    const periods = [
      { period: "2026-08-27", new_users: 2, total_users: 70, daily_active: 10, weekly_active: 30, monthly_active: 50 },
      { period: "2026-08-28", new_users: 3, total_users: 73, daily_active: 12, weekly_active: 32, monthly_active: 52 },
      { period: "2026-08-29", new_users: 1, total_users: 74, daily_active: 13, weekly_active: 34, monthly_active: 55 },
    ];
    const db = {
      prepare: () => ({
        bind() { return this; },
        async first() { return null; },
        async all() { return { results: periods }; },
      }),
    };
    const { loadNoxCueDigestData } = await import("../noxcue-digest-data.js");
    const summary = await loadNoxCueDigestData(db, "source-1", "2026-08-29");
    expect(summary.derivedFromEvents).toBe(true);
    expect(summary.metrics).toMatchObject({
      "users.new": 1,
      "users.total": 74,
      "users.active.daily": 13,
      "users.active.weekly": 34,
      "users.active.monthly": 55,
      "users.stickiness.dau_mau": 13 / 55,
    });
    expect(summary.comparisons["users.new"]).toEqual({
      yesterday: 3,
      average30d: 2.5,
      sampleDays: 2,
      history: [
        { period: "2026-08-27", value: 2 },
        { period: "2026-08-28", value: 3 },
        { period: "2026-08-29", value: 1 },
      ],
    });
  });

  it("derives daily custom activity counts and rolling weekly activity per active user", async () => {
    const db = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() { return sql.includes("cue_engagement_settings") ? { window_days: 14 } : null; },
          async all() {
            if (sql.includes("cue_custom_metrics")) return { results: [
              { period: "2026-08-27", metric_key: "custom.journals.added", label: "Journals added", daily_events: 2, weekly_events: 40, weekly_active: 20, weekly_participants: 8, previous_weekly_events: 20, previous_weekly_active: 10 },
              { period: "2026-08-28", metric_key: "custom.journals.added", label: "Journals added", daily_events: 4, weekly_events: 44, weekly_active: 20, weekly_participants: 9, previous_weekly_events: 20, previous_weekly_active: 10 },
              { period: "2026-08-29", metric_key: "custom.journals.added", label: "Journals added", daily_events: 6, weekly_events: 50, weekly_active: 20, weekly_participants: 10, previous_weekly_events: 20, previous_weekly_active: 10 },
            ] };
            return { results: [
              { period: "2026-08-27", new_users: 1, total_users: 70, daily_active: 1, weekly_active: 1, monthly_active: 1 },
              { period: "2026-08-28", new_users: 2, total_users: 72, daily_active: 1, weekly_active: 1, monthly_active: 1 },
              { period: "2026-08-29", new_users: 2, total_users: 74, daily_active: 1, weekly_active: 1, monthly_active: 1 },
            ] };
          },
        };
      },
    };
    const { loadNoxCueDigestData } = await import("../noxcue-digest-data.js");
    const summary = await loadNoxCueDigestData(db, "source-1", "2026-08-29");
    expect(summary.metrics["custom.journals.added"]).toBe(6);
    expect(summary.metrics["custom.journals.added.per_mau"]).toBeCloseTo(50 / 20);
    expect(summary.metricLabels).toEqual({
      "custom.journals.added": "Journals added",
      "custom.journals.added.per_mau": "Journals added / active user",
    });
    expect(summary.activityBreakdowns["custom.journals.added.per_mau"]).toEqual({
      actionLabel: "journals",
      windowDays: 14,
      totalActions: 50,
      activeUsers: 20,
      participatingUsers: 10,
      participationRate: 0.5,
      actionsPerParticipant: 5,
      previousActions: 20,
      previousActiveUsers: 10,
      previousPerActiveUser: 2,
    });
    expect(summary.comparisons["custom.journals.added"]).toMatchObject({ yesterday: 4, average30d: 3 });
  });

  it("does not treat missing days as zero", () => {
    const summary = summarizeNoxCueDigestRows([
      { period: "2026-08-20", metric_key: "users.active.daily", value: 20, origin: "reported" },
      { period: "2026-08-29", metric_key: "users.active.daily", value: 30, origin: "reported" },
    ], "2026-08-29");
    expect(summary.comparisons["users.active.daily"]).toEqual({
      yesterday: null,
      average30d: 20,
      sampleDays: 1,
      history: [
        { period: "2026-08-20", value: 20 },
        { period: "2026-08-29", value: 30 },
      ],
    });
  });
});
