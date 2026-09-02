import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNarrationStatistics, narrateDailyStats } from "../narration";

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

describe("daily statistics narration", () => {
  it("uses the managed NoxFeed model with deterministic statistical context", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "New users rose to 12, while daily activity stayed close to yesterday." }],
    }), { headers: { "Content-Type": "application/json" } }));

    await expect(narrateDailyStats(input, "managed-key", request))
      .resolves.toBe("New users rose to 12, while daily activity stayed close to yesterday.");
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.headers).toMatchObject({ "x-api-key": "managed-key", "anthropic-version": "2023-06-01" });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "claude-haiku-4-5-20251001", max_tokens: 100 });
    expect(body.system).toContain("Mention at most two metrics");
    expect(body.system).toContain("reference below 5");
    expect(body.system).toContain("under 260 characters");
    const supplied = JSON.parse(body.messages[0].content);
    expect(supplied.statistics[0]).toMatchObject({
      key: "users.new",
      behavior: "daily_flow",
      today: { value: 12, display: "12" },
      dayOverDay: { yesterday: 8, absoluteChange: 4, relativeChangePercent: 50 },
      baseline30d: { mean: 9.5, meanDisplay: "9.5", todayVsMeanDisplay: "2.5 (26.3%) above 30-day mean", sampleDays: 30 },
      momentum: { basis: "daily_value", recent7MeanDisplay: "10.3" },
    });
    expect(supplied.statistics[0].series).toHaveLength(15);
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

  it("does not call the provider without a server key", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(narrateDailyStats(input, undefined, request)).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("falls back cleanly when the provider fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = vi.fn<typeof fetch>(async () => new Response("unavailable", { status: 503 }));
    await expect(narrateDailyStats(input, "managed-key", request)).resolves.toBeUndefined();
  });

  it("normalizes and bounds provider output", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      content: [{ type: "text", text: `  "${"A".repeat(600)}"  ` }],
    })));
    const result = await narrateDailyStats(input, "managed-key", request);
    expect(result).toHaveLength(300);
    expect(result?.endsWith("…")).toBe(true);
  });
});
