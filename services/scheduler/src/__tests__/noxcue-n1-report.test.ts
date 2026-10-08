import { describe, expect, it } from "vitest";
import { buildDigestResponse } from "../../../cue/src/response";

describe("N1 report card budget", () => {
  it("renders at most 14 cards across no more than six groups", () => {
    const metrics = Object.fromEntries([
      "users.new", "users.total", "subscriptions.trials.new", "subscriptions.trials.total",
      "subscriptions.paid.new", "subscriptions.paid.total", "subscriptions.trial_to_paid",
      "subscriptions.churn", "users.active.daily", "users.active.monthly",
      "records.parsed", "records.parsed.per_active", "reports.generated", "reports.generated.per_active",
      "records.parsed.users.total", "reports.generated.users.total",
    ].map((key, index) => [key, index + 1]));
    const response = buildDigestResponse("N1 App — Production Stats", "2026-10-06", metrics);
    const blocks = response.message.blocks as Array<{ type: string; fields?: unknown[]; text?: { text?: string } }>;
    const cards = blocks.reduce((total, block) => total + (block.fields?.length ?? 0), 0);
    const groups = blocks.filter((block) => block.type === "section" && block.text?.text?.startsWith("*")).length;
    expect(cards).toBeLessThanOrEqual(14);
    expect(groups).toBeLessThanOrEqual(6);
    expect(response.message.text).toContain("N1 App — Production Stats");
  });
});
