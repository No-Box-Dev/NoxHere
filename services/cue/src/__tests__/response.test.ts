import { describe, expect, it } from "vitest";
import { buildDigestResponse, buildGitHubIncident, buildTestResponse } from "../response";

const incidentInput = {
  environment: "production",
  incidentKey: "error.occurred/api/network_error/fetchlibrary",
  title: "Library request failed",
  sourceName: "Playnist <web>",
  firstSeenAt: "2026-10-08T05:31:00Z",
  lastSeenAt: "2026-10-08T05:32:00Z",
  occurrenceCount: 7,
  payloadJson: JSON.stringify({
    impact: "The library could not load.",
    message: "GET https://playnist.com/api/users/private-user/library?token=secret failed",
    error: {
      name: "TypeError",
      message: "Failed to fetch",
      code: "NETWORK_ERROR",
      stack: "at load (https://playnist.com/assets/app.js?account=private:10:4)",
    },
    context: {
      environment: "production",
      release: "web-123",
      runtime: "browser",
      url: "https://playnist.com/users/private-user/library?token=secret#private",
    },
    diagnosis: {
      possibleCauses: ["The request path was interrupted."],
      possibleFixes: ["Inspect edge logs."],
    },
  }),
};

describe("NoxCue response policy", () => {
  it("builds a bounded GitHub incident through the owned response contract", () => {
    const response = buildGitHubIncident(incidentInput, { url: "https://github.com/acme/playnist/issues/12" });

    expect(response).toMatchObject({
      contract: "noxcue.response",
      version: 1,
      kind: "github_incident",
      marker: "<!-- noxcue-key: production/error.occurred/api/network_error/fetchlibrary -->",
      title: "[NoxCue] Library request failed",
      latestRelease: "web-123",
    });
    expect(response.labels.map(({ name }) => name)).toEqual(["noxcue", "incident"]);
    expect(response.body).toContain("Origin: https://playnist\\.com");
    expect(response.body).toContain("Previous occurrence: https://github.com/acme/playnist/issues/12");
    expect(response.body).not.toContain("private-user");
    expect(response.body).not.toContain("token=secret");
    expect(response.body.length).toBeLessThanOrEqual(30_000);
  });

  it("fails closed for malformed, oversized, or private diagnostic payloads", () => {
    expect(() => buildGitHubIncident({ ...incidentInput, payloadJson: "{" })).toThrow("invalid diagnostic payload");
    expect(() => buildGitHubIncident({ ...incidentInput, payloadJson: "x".repeat(24_001) })).toThrow("payloadJson");
    expect(() => buildGitHubIncident({
      ...incidentInput,
      payloadJson: JSON.stringify({
        impact: "Failure",
        affectedUser: "private@example.test",
        diagnosis: { possibleCauses: [], possibleFixes: [] },
      }),
    })).toThrow("invalid diagnostic payload");
  });

  it("rejects unsafe marker and previous-issue inputs", () => {
    expect(() => buildGitHubIncident({ ...incidentInput, incidentKey: "safe/-->unsafe" })).toThrow("incidentKey");
    expect(() => buildGitHubIncident(incidentInput, { url: "https://github.com/acme/repo/issues/1?secret=yes" })).toThrow("previousIssueUrl");
  });

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
      { type: "context", elements: [{ text: "NoxCue · Daily trends plus trailing-7-day activity per active user · completed days only" }] },
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

  it("groups custom activity metrics separately in the text fallback", () => {
    const response = buildDigestResponse("Playnist", "2026-08-29", {
      "custom.comments.written": 210,
      "custom.comments.written.per_user": 2.92,
    });
    const rendered = JSON.stringify(response.message.blocks);
    expect(rendered).toContain("✍️ Activity");
    expect(rendered).toContain("Comments written / user");
    expect(rendered).toContain("2.92");
  });

  it("preserves the legacy report order when labels only describe custom activity", () => {
    const response = buildDigestResponse("Playnist", "2026-10-07", {
      "users.new": 0,
      "users.total": 214,
      "users.active.daily": 11,
      "users.active.weekly": 64,
      "users.active.monthly": 139,
      "users.stickiness.dau_mau": 11 / 139,
      "custom.comments.written": 1,
    }, {}, "https://noxcue.example/chart.png", undefined, {
      "custom.comments.written": "Comments written",
    });
    const image = response.message.blocks.find((block) => block.type === "image") as { alt_text: string };
    const expectedOrder = ["New users", "Total users", "Daily active", "Weekly active", "Monthly active", "DAU / MAU", "Comments written"];
    for (let index = 1; index < expectedOrder.length; index += 1) {
      expect(image.alt_text.indexOf(expectedOrder[index - 1]!)).toBeLessThan(image.alt_text.indexOf(expectedOrder[index]!));
    }
  });

  it("keeps activity breadth and depth in the text fallback", () => {
    const response = buildDigestResponse("Playnist", "2026-10-02", {
      "custom.comments.written.per_mau": 1.06,
    }, {}, undefined, undefined, {
      "custom.comments.written.per_mau": "Comments written / active user",
    }, {
      "custom.comments.written.per_mau": {
        actionLabel: "comments", totalActions: 175, activeUsers: 165,
        participatingUsers: 30, participationRate: 30 / 165,
        actionsPerParticipant: 175 / 30, previousActions: 120,
        previousActiveUsers: 165, previousPerActiveUser: 120 / 165,
      },
    });
    const rendered = JSON.stringify(response.message.blocks);
    expect(rendered).toContain("Comments per active user");
    expect(rendered).toContain("175 comments ÷ 165 active users");
    expect(rendered).toContain("18.2% participated · 5.83 per participant");
    expect(rendered).toContain("vs previous 7d");
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
