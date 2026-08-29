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
    expect(svg).toContain(">+1 vs yesterday</text>");
    expect(svg).toContain(">30d avg 1.7</text>");
    expect(svg.match(/<path d="M/g)).toHaveLength(1);
    expect(svg).not.toContain("<script");
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
