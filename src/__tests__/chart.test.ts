import { describe, expect, it } from "vitest";
import { buildChartSvg } from "../chart";

describe("NoxCue chart", () => {
  it("renders a compact two-column line-chart card", () => {
    const svg = buildChartSvg({
      sourceName: "Playnist",
      period: "2026-08-28",
      metrics: {
        "users.new": 4,
        "users.total": 72,
        "users.active.daily": 7,
        "users.active.weekly": 19,
        "users.active.monthly": 53,
        "users.stickiness.dau_mau": 0.132,
      },
      comparisons: {
        "users.new": {
          yesterday: 3,
          average30d: 1.7,
          sampleDays: 30,
          history: [0, 3, 1, 4].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
        },
      },
    });
    expect(svg).toContain('width="1000"');
    expect(svg).toContain(">New users</text>");
    expect(svg).toContain(">↑ 1 · 33.3% vs yesterday</text>");
    expect(svg).toContain(">30d avg 1.7</text>");
    expect(svg).toContain('stroke="#7aa7ff"');
    expect(svg).toContain('stroke-dasharray="6 7"');
    expect(svg).not.toContain("No change");
    expect(svg).not.toContain("#5ee38f");
    expect(svg).not.toContain("#f6a33a");
    expect(svg.match(/<path d="M/g)).toHaveLength(1);
    expect(svg).not.toContain("<script");
  });

  it("names a flat comparison and keeps it visually neutral", () => {
    const svg = buildChartSvg({
      sourceName: "Playnist",
      period: "2026-08-29",
      metrics: { "users.active.daily": 7 },
      comparisons: {
        "users.active.daily": {
          yesterday: 7,
          average30d: 9.1,
          sampleDays: 30,
          history: [10, 8, 7, 7].map((value, index) => ({ period: String(index), value })),
        },
      },
    });
    expect(svg).toContain(">Same as yesterday</text>");
    expect(svg).toContain('class="delta"');
    expect(svg).not.toMatch(/class="delta"[^>]+fill=/);
  });

  it("escapes labels before placing them in SVG", () => {
    const svg = buildChartSvg({
      sourceName: "A&B",
      period: "2026-08-28",
      metrics: { "users.new": 1 },
      comparisons: {},
    });
    expect(svg).toContain(">New users</text>");
    expect(svg).not.toContain("A&B");
  });
});
