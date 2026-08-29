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
    });
    expect(response).toMatchObject({ contract: "noxcue.response", kind: "daily_digest" });
    expect(response.message.text).toBe("Acme: 86 new users on 2026-08-29");
    expect(response.message.blocks).toMatchObject([
      { type: "header", text: { text: "📊 Acme · Daily pulse" } },
      { type: "context", elements: [{ text: "Aug 29, 2026 · UTC · completed day" }] },
      { type: "section", text: { text: "*🌱 Growth*" } },
      { type: "section", fields: [
        { text: "*New users*\n*86*  ▲ +6\n`▁▄▃▇█`  _30 days_\nYesterday 80 · 30d avg 74.3" },
        { text: "*Total users*\n*4,210*  ▲ +86\n`▁▃▄▇█`  _30 days_\nYesterday 4,124 · 30d avg 3,900.2" },
      ] },
      { type: "section", text: { text: "*⚡ Engagement*" } },
      { type: "section", fields: [
        { text: "*Daily active*\n*2,420*  ▲ +120\n`▁▅▄▆█`  _30 days_\nYesterday 2,300 · 30d avg 2,104.4" },
        { text: "*Weekly active*\n*8,400*  ▲ +200\n`▁▃▅▆█`  _30 days_\nYesterday 8,200 · 30d avg 7,900" },
        { text: "*Monthly active*\n*12,900*  ▲ +100\n`▁▄▆▇█`  _30 days_\nYesterday 12,800 · 30d avg 12,300" },
        { text: "*DAU / MAU*\n*18.8%*  ▲ +0.8pp\n`▁▅▄▇█`  _30 days_\nYesterday 18% · 30d avg 17.1%" },
      ] },
      { type: "context", elements: [{ text: "NoxCue · 30-day trend · stored completed days only" }] },
    ]);
    const rendered = response.message.blocks.flatMap((block) =>
      Array.isArray(block.fields)
        ? (block.fields as Array<{ text: string }>).map((field) => field.text)
        : [],
    ).join("\n");
    expect(rendered).toContain("\n");
    expect(rendered).not.toContain("\\n");
    expect(rendered).toContain("*DAU / MAU*\n*18.8%*  ▲ +0.8pp");
  });

  it("renders stable and falling trends without inventing history", () => {
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
    expect(rendered).toContain("→ flat");
    expect(rendered).toContain("`▁▁▁`  _30 days_");
    expect(rendered).toContain("▼ −2");
    expect(rendered).toContain("`█▆▁`  _30 days_");
  });

  it("compresses a full month into a readable 12-point sparkline", () => {
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
    const chart = text.match(/`([^`]+)`/)?.[1];
    expect(chart).toHaveLength(12);
    expect(chart).toBe("▁▂▂▃▄▄▅▅▆▇▇█");
  });

  it("requires at least one supported user metric", () => {
    expect(() => buildDigestResponse("Acme", "2026-08-29", { "errors.total": 10 }))
      .toThrow("no supported user statistics");
  });
});
