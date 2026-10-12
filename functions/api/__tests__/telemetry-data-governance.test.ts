import { describe, expect, it } from "vitest";
import { telemetrySourceInputSchema } from "../../lib/telemetry-settings";

describe("Telemetry governance controls", () => {
  it("bounds source retention and supports aggregate-only delivery", () => {
    expect(telemetrySourceInputSchema.safeParse({ name: "N1", projectId: "n1", retentionDays: 6 }).success).toBe(false);
    expect(telemetrySourceInputSchema.safeParse({ name: "N1", projectId: "n1", retentionDays: 731 }).success).toBe(false);
    expect(telemetrySourceInputSchema.parse({ name: "N1", projectId: "n1", retentionDays: 30, aggregateOnlySlack: true }))
      .toMatchObject({ retentionDays: 30, aggregateOnlySlack: true });
  });
});
