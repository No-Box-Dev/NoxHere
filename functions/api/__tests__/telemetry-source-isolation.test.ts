import { describe, expect, it } from "vitest";
import { telemetrySourceInputSchema } from "../../lib/telemetry-settings";

const base = { name: "N1 Website", projectId: "n1" };

describe("Telemetry source isolation", () => {
  it("keeps origins, event names and report policy on each source", () => {
    const source = telemetrySourceInputSchema.parse({
      ...base,
      environment: "production",
      allowedOrigins: ["https://n1.care"],
      allowedEvents: ["website.page_visited", "website.signup_clicked"],
      reportTitle: "N1 Website — Website Activity",
      productionStats: true,
    });
    expect(source.allowedOrigins).toEqual(["https://n1.care"]);
    expect(source.allowedEvents).not.toContain("app.user_registered");
    expect(source.reportTitle).toBe("N1 Website — Website Activity");
  });

  it("refuses to mark staging or test sources as production statistics", () => {
    expect(telemetrySourceInputSchema.safeParse({ ...base, environment: "staging", productionStats: true }).success).toBe(false);
    expect(telemetrySourceInputSchema.safeParse({ ...base, environment: "test", productionStats: true }).success).toBe(false);
  });
});
