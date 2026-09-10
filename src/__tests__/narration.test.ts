import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNarrationCandidates, buildNarrationStatistics, narrateDailyStats } from "../narration";

const dailyHistory = Array.from({ length: 15 }, (_, index) => ({
  period: `2026-08-${String(16 + index).padStart(2, "0")}`,
  value: index < 7 ? 6 + index % 2 : 9 + index % 3,
}));

const input = {
  sourceName: "Playnist",
  period: "2026-08-30",
  metrics: { "users.new": 12, "users.active.daily": 80 },
  comparisons: {
    "users.new": { yesterday: 8, average30d: 9.5, sampleDays: 30, history: dailyHistory },
    "users.active.daily": { yesterday: 82, average30d: 75, sampleDays: 30, history: dailyHistory.map((point) => ({ ...point, value: point.value * 8 })) },
  },
};

afterEach(() => vi.restoreAllMocks());

function completionFrom(request: typeof fetch) {
  return async (prompt: { purpose: string; system: string; user: string; maxTokens: number; responseFormat: "text" }) => {
    const response = await request("https://connector.invalid/complete", { method: "POST", body: JSON.stringify(prompt) });
    if (!response.ok) throw new Error(`completion ${response.status}`);
    const value = await response.json() as { stop_reason?: string; content?: Array<{ type?: string; text?: string }> };
    if (value.stop_reason === "max_tokens") throw new Error("truncated completion");
    return value.content?.find((block) => block.type === "text")?.text;
  };
}

describe("daily statistics narration", () => {
  it("asks the managed model for an editorial review using complete selected-metric context", async () => {
    const review = "Acquisition improved with 12 new users, while daily activity remained close to its recent norm at 80 users.";
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    }), { headers: { "Content-Type": "application/json" } }));

    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe(review);
    const [, init] = request.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ purpose: "daily-statistics-narration", maxTokens: 240, responseFormat: "text" });
    expect(body.system).toContain("Analyze the entire supplied dataset privately");
    expect(body.system).toContain("hard limit of 100 words");
    expect(body.system).toContain("same metric's dated series");
    expect(body.system).toContain("cause cannot be determined");
    expect(body.system).toContain("Never describe aggregate product statistics as healthy or unhealthy");
    expect(body.system).not.toContain("for example");
    const supplied = JSON.parse(body.user);
    expect(supplied.selectedMetrics).toEqual(expect.arrayContaining([expect.objectContaining({
      key: "users.new",
      behavior: "daily_flow",
      today: { value: 12, display: "12" },
      series: expect.any(Array),
    })]));
    expect(body.user).toContain("relativeChangePercent");
  });

  it("offers only one metric per group and removes redundant totals and per-user variants", () => {
    const candidates = buildNarrationCandidates({
      ...input,
      metrics: {
        ...input.metrics,
        "users.total": 128,
        "users.active.weekly": 90,
        "custom.reviews.written": 3,
        "custom.reviews.written.per_user": 0.02,
      },
      comparisons: {
        ...input.comparisons,
        "users.total": { yesterday: 127, average30d: 110, sampleDays: 30 },
        "users.active.weekly": { yesterday: 88, average30d: 84, sampleDays: 30 },
        "custom.reviews.written": { yesterday: 0, average30d: 0.5, sampleDays: 30 },
        "custom.reviews.written.per_user": { yesterday: 0, average30d: 0.01, sampleDays: 30 },
      },
    });
    const keys = new Set(candidates.map(({ key }) => key));
    expect(keys).toContain("users.new");
    expect(keys).not.toContain("users.total");
    expect(keys).not.toContain("custom.reviews.written.per_user");
    expect([...keys].filter((key) => key.startsWith("users.active."))).toHaveLength(1);
  });

  it("does not choose a provider model inside NoxCue", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "Daily active users were lower than yesterday." }],
    })));
    await narrateDailyStats(input, completionFrom(request));
    const body = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(body).not.toHaveProperty("model");
  });

  it("analyzes cumulative totals using daily changes instead of their rising level", () => {
    const totals = Array.from({ length: 15 }, (_, index) => ({
      period: `2026-08-${String(16 + index).padStart(2, "0")}`,
      value: 100 + index * 2,
    }));
    const [statistic] = buildNarrationStatistics({
      sourceName: "Playnist",
      period: "2026-08-30",
      metrics: { "users.total": 128 },
      comparisons: { "users.total": { yesterday: 126, average30d: 114, sampleDays: 30, history: totals } },
    });
    expect(statistic).toMatchObject({
      behavior: "cumulative_stock",
      dayOverDay: { absoluteChange: 2 },
      momentum: {
        basis: "daily_change_in_total",
        recent7Mean: 2,
        previous7Mean: 2,
        direction: "stable",
      },
    });
  });

  it("uses deterministic narration without a managed completion", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(narrateDailyStats(input)).resolves.toBe("Daily activity fell to 80 users from 82 yesterday. 12 new users signed up, up from 8 yesterday.");
    expect(request).not.toHaveBeenCalled();
  });

  it("falls back cleanly when the provider fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = vi.fn<typeof fetch>(async () => new Response("unavailable", { status: 503 }));
    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe("Daily activity fell to 80 users from 82 yesterday. 12 new users signed up, up from 8 yesterday.");
  });

  it("ignores unapproved model prose and renders deterministic facts", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: `  "${"A".repeat(600)}"  ` }],
    })));
    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe("Daily activity fell to 80 users from 82 yesterday. 12 new users signed up, up from 8 yesterday.");
  });

  it("rejects quantitative claims that are absent from the supplied statistics", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "Daily activity reached 999 users." }],
    })));
    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe("Daily activity fell to 80 users from 82 yesterday. 12 new users signed up, up from 8 yesterday.");
  });

  it("accepts calendar dates present in the supplied history", async () => {
    const review = "The August 29 lift has eased, while 12 new users joined today.";
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    })));
    await expect(narrateDailyStats(input, completionFrom(request))).resolves.toBe(review);
  });

  it("accepts displayed percentages from a ratio history", async () => {
    const ratioInput = {
      sourceName: "Small launch",
      period: "2026-08-30",
      metrics: { "users.stickiness.dau_mau": 0.22 },
      comparisons: {
        "users.stickiness.dau_mau": {
          yesterday: 0.25,
          average30d: 0.24,
          sampleDays: 3,
          history: [
            { period: "2026-08-28", value: 0.18 },
            { period: "2026-08-29", value: 0.35 },
            { period: "2026-08-30", value: 0.22 },
          ],
        },
      },
    };
    const review = "DAU / MAU was 22%, within its recent 18% to 35% range.";
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    })));
    await expect(narrateDailyStats(ratioInput, completionFrom(request))).resolves.toBe(review);
  });

  it("rejects a provider response truncated at the token limit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "Daily activity was 80 users but" }],
    })));
    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe("Daily activity fell to 80 users from 82 yesterday. 12 new users signed up, up from 8 yesterday.");
  });

  it("trims an overlong review only at a complete sentence boundary", async () => {
    const review = "Daily activity was 80 users. ".repeat(30).trim();
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    })));
    const narration = await narrateDailyStats(input, completionFrom(request));
    expect(narration).toBeDefined();
    expect(narration!.split(/\s+/)).toHaveLength(110);
    expect(narration).toMatch(/\.$/);
  });

  it("does not split a percentage decimal while trimming", async () => {
    const ratioInput = {
      ...input,
      metrics: { ...input.metrics, "users.stickiness.dau_mau": 0.156 },
      comparisons: {
        ...input.comparisons,
        "users.stickiness.dau_mau": { yesterday: 0.2, average30d: 0.18, sampleDays: 2 },
      },
    };
    const review = `${"Daily activity was 80 users. ".repeat(20)}DAU / MAU was 15.6% as monthly activity expanded. This final sentence exceeds the limit.`;
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    })));
    const narration = await narrateDailyStats(ratioInput, completionFrom(request));
    expect(narration).toMatch(/DAU \/ MAU was 15\.6% as monthly activity expanded\.$/);
    expect(narration).not.toContain("This final sentence");
  });

  it("removes unsupported causal and normality claims while retaining factual sentences", async () => {
    const review = "Daily activity was 80 users, reflecting new-user growth. 12 new users signed up. The dip was normal.";
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: review }],
    })));
    await expect(narrateDailyStats(input, completionFrom(request)))
      .resolves.toBe("12 new users signed up.");
  });

  it("suppresses dramatic-looking trends caused by tiny baselines", () => {
    const lowVolumeHistory = [
      ...Array.from({ length: 7 }, (_, index) => ({ period: `2026-08-${String(16 + index).padStart(2, "0")}`, value: index === 0 ? 1 : 0 })),
      ...Array.from({ length: 7 }, (_, index) => ({ period: `2026-08-${String(23 + index).padStart(2, "0")}`, value: index < 3 ? 2 : 1 })),
    ];
    const candidates = buildNarrationCandidates({
      sourceName: "Playnist",
      period: "2026-08-30",
      metrics: { "users.new": 1 },
      comparisons: {
        "users.new": { yesterday: 3, average30d: 0.8, sampleDays: 30, history: lowVolumeHistory },
      },
    });

    expect(candidates).toEqual([expect.objectContaining({
      horizon: "completed_day",
      sentence: "1 new user signed up, down from 3 yesterday.",
    })]);
  });
});
