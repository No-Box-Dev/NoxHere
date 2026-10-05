import { describe, expect, it } from "vitest";
import { bootstrapSchema, ticketFeatureSchema } from "./contracts";

describe("API contracts", () => {
  it("accepts an API-backed project bootstrap", () => {
    const result = bootstrapSchema.parse({
      actor: { id: "JasperNoBoxDev", name: "JasperNoBoxDev", initials: "JA", accessLevel: "member", isAdmin: true, allowedServiceIds: [] },
      organization: { id: "no-box-dev", name: "No-Box-Dev" },
      projects: [{ id: "proj_no-box-dev_playnist", name: "playnist", organizationId: "no-box-dev", environment: "production", connections: [], members: [] }],
    });
    expect(result.projects[0].id).toBe("proj_no-box-dev_playnist");
  });

  it("accepts the NoxTicket feature shape with descriptions and links", () => {
    const features = ticketFeatureSchema.array().parse([{ number: 151, title: "Filters", state: "open", priority: 2, description: "Browse by platform", links: [{ label: "Design", url: "https://figma.com/example" }], assignees: [{ login: "jasper" }], labels: [{ name: "status:review" }], updated_at: "2026-09-19T00:00:00Z" }]);
    expect(features[0].number).toBe(151);
    expect(features[0].links?.[0].label).toBe("Design");
    expect(features[0].priority).toBe(2);
  });
});
