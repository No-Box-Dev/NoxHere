import { describe, expect, it } from "vitest";
import {
  appForApiPath,
  appForDeliverySource,
  appForSlackKind,
  getEnabledApps,
  isAppEnabled,
  parseAppSettings,
} from "../apps.js";

describe("server capability routing", () => {
  it("keeps product capabilities available regardless of legacy settings", async () => {
    expect(parseAppSettings(null)).toEqual({ noxticket: true, noxfeed: true, noxspot: true, noxcue: true });
    expect(parseAppSettings('{"apps":{"noxspot":false}}')).toEqual({
      noxticket: true,
      noxfeed: true,
      noxspot: true,
      noxcue: true,
    });
    await expect(getEnabledApps()).resolves.toEqual({ noxticket: true, noxfeed: true, noxspot: true, noxcue: true });
    await expect(isAppEnabled({}, 7, "noxfeed", "project-a")).resolves.toBe(true);
  });

  it("maps only service-owned entry points and delivery work", () => {
    expect(appForApiPath("/api/features/12")).toBe("noxticket");
    expect(appForApiPath("/api/v1/features/12")).toBe("noxticket");
    expect(appForApiPath("/api/v1/feed")).toBe("noxfeed");
    expect(appForApiPath("/api/v1/feed/current-summary")).toBe("noxfeed");
    expect(appForApiPath("/api/issues")).toBe("noxfeed");
    expect(appForApiPath("/api/v1/issues")).toBe("noxfeed");
    expect(appForApiPath("/api/v1/prs/close")).toBe("noxfeed");
    expect(appForApiPath("/api/v1/engineer-activity")).toBe("noxfeed");
    expect(appForApiPath("/api/v1/llm-settings")).toBe("noxfeed");
    expect(appForApiPath("/api/spots/sites")).toBe("noxspot");
    expect(appForApiPath("/api/v1/spots/sites")).toBe("noxspot");
    expect(appForApiPath("/api/cues/sources")).toBe("noxcue");
    expect(appForApiPath("/api/v1/cues/sources")).toBe("noxcue");
    expect(appForApiPath("/api/v1/projects/project-1/cue/alerts")).toBe("noxcue");
    expect(appForApiPath("/api/repos")).toBeNull();
    expect(appForDeliverySource("release_notes")).toBe("noxfeed");
    expect(appForDeliverySource("noxfeed_daily_summary")).toBe("noxfeed");
    expect(appForDeliverySource("noxticket")).toBe("noxticket");
    expect(appForDeliverySource(["un", "ticket"].join(""))).toBe("noxticket");
    expect(appForSlackKind("noxticket")).toBe("noxticket");
    expect(appForSlackKind("noxspot")).toBe("noxspot");
    expect(appForSlackKind("noxfeed_daily_summary")).toBe("noxfeed");
  });

});
