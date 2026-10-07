import { describe, expect, it } from "vitest";
import { cueSourceInputSchema } from "../../lib/noxcue-settings";

describe("NoxCue governance controls", () => {
  it("bounds source retention and supports aggregate-only delivery", () => {
    expect(cueSourceInputSchema.safeParse({ name: "N1", projectId: "n1", retentionDays: 6 }).success).toBe(false);
    expect(cueSourceInputSchema.safeParse({ name: "N1", projectId: "n1", retentionDays: 731 }).success).toBe(false);
    expect(cueSourceInputSchema.parse({ name: "N1", projectId: "n1", retentionDays: 30, aggregateOnlySlack: true }))
      .toMatchObject({ retentionDays: 30, aggregateOnlySlack: true });
  });
});
