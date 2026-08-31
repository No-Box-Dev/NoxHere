import { afterEach, describe, expect, it, vi } from "vitest";
import { narrateDailyStats } from "../narration";

const input = {
  sourceName: "Playnist",
  period: "2026-08-30",
  metrics: { "users.new": 12, "users.active.daily": 80 },
  comparisons: {
    "users.new": { yesterday: 8, average30d: 9.5, sampleDays: 30 },
    "users.active.daily": { yesterday: 82, average30d: 75, sampleDays: 30 },
  },
};

afterEach(() => vi.restoreAllMocks());

describe("daily statistics narration", () => {
  it("uses the managed NoxFeed model with a small, factual input", async () => {
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
    expect(body.messages[0].content).toContain('"current":12');
    expect(body.messages[0].content).not.toContain("history");
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
      content: [{ type: "text", text: `  "${"A".repeat(400)}"  ` }],
    })));
    const result = await narrateDailyStats(input, "managed-key", request);
    expect(result).toHaveLength(280);
    expect(result?.endsWith("…")).toBe(true);
  });
});
