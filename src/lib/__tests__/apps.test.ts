import { describe, expect, it } from "vitest";
import { ALL_NOX_APP_IDS, getDefaultEnabledTab, getAppForTab, isTabEnabled } from "../apps";

describe("Nox app configuration", () => {
  it("makes every capability available", () => {
    expect(ALL_NOX_APP_IDS).toEqual(["noxconnect", "noxticket", "noxfeed", "noxspot", "noxcue"]);
  });

  it("maps every product view to its owning app", () => {
    expect(getAppForTab("sprint")).toBe("noxticket");
    expect(getAppForTab("issues")).toBe("noxfeed");
    expect(getAppForTab("repos")).toBe("noxconnect");
  });

  it("uses Activity as the normal landing capability", () => {
    expect(getDefaultEnabledTab(ALL_NOX_APP_IDS)).toBe("issues");
    expect(getDefaultEnabledTab(["noxconnect"])).toBe("admin");
    expect(isTabEnabled("issues", ALL_NOX_APP_IDS)).toBe(true);
  });
});
