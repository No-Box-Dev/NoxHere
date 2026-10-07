import { describe, expect, it } from "vitest";
import { cueSourceInputSchema } from "../../lib/noxcue-settings";

const base = { name: "N1 Website", projectId: "n1" };

describe("NoxCue source isolation", () => {
  it("keeps origins, event names and report policy on each source", () => {
    const source = cueSourceInputSchema.parse({
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
    expect(cueSourceInputSchema.safeParse({ ...base, environment: "staging", productionStats: true }).success).toBe(false);
    expect(cueSourceInputSchema.safeParse({ ...base, environment: "test", productionStats: true }).success).toBe(false);
  });
});
