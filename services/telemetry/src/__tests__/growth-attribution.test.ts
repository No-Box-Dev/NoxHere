import { describe, expect, it } from "vitest";
import { classifyGrowthChannel } from "../events";

describe("Growth attribution", () => {
  it("uses explicit campaign media before referrer inference", () => {
    expect(classifyGrowthChannel({ medium: "cpc", referrerHost: "google.com" })).toBe("Paid search");
    expect(classifyGrowthChannel({ medium: "email" })).toBe("Email");
    expect(classifyGrowthChannel({ medium: "paid_social", source: "linkedin" })).toBe("Paid social");
  });

  it("classifies organic, referral, campaign and direct visits deterministically", () => {
    expect(classifyGrowthChannel({ referrerHost: "www.google.com" })).toBe("Organic search");
    expect(classifyGrowthChannel({ referrerHost: "partner.example" })).toBe("Referral");
    expect(classifyGrowthChannel({ source: "launch" })).toBe("Campaign");
    expect(classifyGrowthChannel({})).toBe("Direct");
  });
});
