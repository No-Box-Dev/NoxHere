import { describe, expect, it } from "vitest";
import { buildDigestResponse, buildTestResponse } from "../response";

describe("NoxCue response policy", () => {
  it("owns its delivery test message", () => {
    const response = buildTestResponse("Acme<&>");
    expect(response).toMatchObject({ contract: "noxcue.response", version: 1 });
    expect(response.message.text).toBe("NoxCue delivery test for Acme<&>");
    expect(JSON.stringify(response.message.blocks)).toContain("Acme&lt;&amp;&gt;");
  });

  it("renders the complete daily user-stat card with historical comparisons", () => {
    const response = buildDigestResponse("Acme", "2026-08-29", {
      "users.new": 86,
      "users.total": 4210,
      "users.active.daily": 2420,
      "users.active.weekly": 8400,
      "users.active.monthly": 12900,
      "users.stickiness.dau_mau": 0.1876,
      "errors.total": 23,
      "errors.unique": 6,
    }, {
      "users.new": {
        yesterday: 80, average30d: 74.25, sampleDays: 30,
        history: [40, 60, 50, 80, 86].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
      "users.total": {
        yesterday: 4124, average30d: 3900.2, sampleDays: 30,
        history: [3800, 3900, 4000, 4124, 4210].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
      "users.active.daily": {
        yesterday: 2300, average30d: 2104.4, sampleDays: 30,
        history: [1900, 2200, 2100, 2300, 2420].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
      "users.active.weekly": {
        yesterday: 8200, average30d: 7900, sampleDays: 30,
        history: [7500, 7800, 8000, 8200, 8400].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
      "users.active.monthly": {
        yesterday: 12800, average30d: 12300, sampleDays: 30,
        history: [12000, 12400, 12600, 12800, 12900].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
      "users.stickiness.dau_mau": {
        yesterday: 0.1797, average30d: 0.1711, sampleDays: 30,
        history: [0.15, 0.17, 0.166, 0.1797, 0.1876].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
      },
    }, "https://noxcue.example/v1/charts/123.png");
    expect(response).toMatchObject({ contract: "noxcue.response", kind: "daily_digest" });
    expect(response.message.text).toBe("Acme: 86 new users on 2026-08-29");
    expect(response.message.blocks).toMatchObject([
      { type: "header", text: { text: "📊 Acme · Daily pulse" } },
      { type: "context", elements: [{ text: "Aug 29, 2026 · UTC · completed day" }] },
      { type: "image", image_url: "https://noxcue.example/v1/charts/123.png", alt_text: expect.stringContaining("New users: 86, ↑ 6 · 7.5% vs yesterday, 30-day average 74.3") },
      { type: "context", elements: [{ text: "NoxCue · Solid: daily values · Dashed: 30d average · completed days only" }] },
    ]);
    expect(response.message.blocks).toHaveLength(4);
    expect(JSON.stringify(response.message.blocks)).toContain("DAU / MAU: 18.8%, ↑ 0.8pp vs yesterday");
  });

  it("keeps a readable text fallback if image generation is unavailable", () => {
    const response = buildDigestResponse("Acme", "2026-08-29", {
      "users.new": 0,
      "users.active.daily": 7,
    }, {
      "users.new": {
        yesterday: 0,
        average30d: 1.7,
        sampleDays: 30,
        history: [0, 0, 0].map((value, index) => ({ period: `2026-08-${27 + index}`, value })),
      },
      "users.active.daily": {
        yesterday: 9,
        average30d: 9.1,
        sampleDays: 30,
        history: [10, 9, 7].map((value, index) => ({ period: `2026-08-${27 + index}`, value })),
      },
    });
    const rendered = JSON.stringify(response.message.blocks);
    expect(rendered).toContain("Same as yesterday");
    expect(rendered).toContain("↓ 2 · 22.2% vs yesterday");
    expect(rendered).toContain("Yesterday 9 · 30d avg 9.1");
    expect(rendered).not.toContain("image_url");
  });

  it("places an escaped AI brief above the chart", () => {
    const response = buildDigestResponse("Acme", "2026-08-29", {
      "users.new": 4,
    }, {}, "https://noxcue.example/chart.png", "Signups rose <without a known cause> & stayed healthy.");
    expect(response.message.blocks).toMatchObject([
      { type: "header" },
      { type: "context" },
      { type: "section", text: { text: "✨ *In brief*\nSignups rose &lt;without a known cause&gt; &amp; stayed healthy." } },
      { type: "image", image_url: "https://noxcue.example/chart.png" },
      { type: "context" },
    ]);
  });

  it("does not put text sparklines into fallback fields", () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      period: `2026-08-${String(index + 1).padStart(2, "0")}`,
      value: index,
    }));
    const response = buildDigestResponse("Acme", "2026-08-30", {
      "users.total": 29,
    }, {
      "users.total": { yesterday: 28, average30d: 14.5, sampleDays: 30, history },
    });
    const field = response.message.blocks.find((block) => Array.isArray(block.fields));
    const text = (field?.fields as Array<{ text: string }>)[0]!.text;
    expect(text).toContain("Yesterday 28 · 30d avg 14.5");
    expect(text).not.toMatch(/[\u2800-\u28ff▁▂▃▄▅▆▇█]/u);
  });

  it("requires at least one supported user metric", () => {
    expect(() => buildDigestResponse("Acme", "2026-08-29", { "errors.total": 10 }))
      .toThrow("no supported user statistics");
  });
});
