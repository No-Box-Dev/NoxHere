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
    expect(parseAppSettings(null)).toEqual({ planning: true, activity: true, feedback: true, telemetry: true });
    expect(parseAppSettings('{"apps":{"feedback":false}}')).toEqual({
      planning: true,
      activity: true,
      feedback: true,
      telemetry: true,
    });
    await expect(getEnabledApps()).resolves.toEqual({ planning: true, activity: true, feedback: true, telemetry: true });
    await expect(isAppEnabled({}, 7, "activity", "project-a")).resolves.toBe(true);
  });

  it("maps only service-owned entry points and delivery work", () => {
    expect(appForApiPath("/api/features/12")).toBe("planning");
    expect(appForApiPath("/api/v1/features/12")).toBe("planning");
    expect(appForApiPath("/api/v1/activity")).toBe("activity");
    expect(appForApiPath("/api/v1/activity/current-summary")).toBe("activity");
    expect(appForApiPath("/api/issues")).toBe("activity");
    expect(appForApiPath("/api/v1/issues")).toBe("activity");
    expect(appForApiPath("/api/v1/prs/close")).toBe("activity");
    expect(appForApiPath("/api/v1/prs/merge")).toBe("activity");
    expect(appForApiPath("/api/v1/engineer-activity")).toBe("activity");
    expect(appForApiPath("/api/v1/llm-settings")).toBe("activity");
    expect(appForApiPath("/api/feedback/sites")).toBe("feedback");
    expect(appForApiPath("/api/v1/feedback/sites")).toBe("feedback");
    expect(appForApiPath("/api/telemetry/sources")).toBe("telemetry");
    expect(appForApiPath("/api/v1/telemetry/sources")).toBe("telemetry");
    expect(appForApiPath("/api/v1/projects/project-1/telemetry/alerts")).toBe("telemetry");
    expect(appForApiPath("/api/repos")).toBeNull();
    expect(appForDeliverySource("release_notes")).toBe("activity");
    expect(appForDeliverySource("activity_daily_summary")).toBe("activity");
    expect(appForDeliverySource("planning")).toBe("planning");
    expect(appForSlackKind("planning")).toBe("planning");
    expect(appForSlackKind("feedback")).toBe("feedback");
    expect(appForSlackKind("activity_daily_summary")).toBe("activity");
  });

});
