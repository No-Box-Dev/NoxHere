import { describe, expect, it } from "vitest";
import { environmentForOrigin, originAllowed, parseWidgetConfig, publicWidgetConfig, siteReadiness, type CaptureSite } from "./site-config";

const site: CaptureSite = {
  id: "site-1",
  org_id: 1,
  project_id: "project-1",
  repo: "web",
  site_name: "Web",
  slack_channel_id: null,
  slack_connection_id: null,
  github_login: "acme",
  project_repo: "web",
  project_archived: 0,
  github_installation_id: 1001,
  effective_slack_channel_id: "C123",
  effective_slack_connection_id: "slack-1",
  slack_connected: 1,
  slack_health_status: "ok",
  slack_channel_health: "verified",
  widget_config: JSON.stringify({
    buttonColor: "#111111",
    buttonText: "Feedback",
    environments: [
      { name: "Production", url: "app.example.com", buttonColor: "#222222", captureMode: "screenshot", enabled: true },
      { name: "Disabled", url: "disabled.example.com", enabled: false },
    ],
    blocks: [
      { id: "all", type: "description", environments: [] },
      { id: "prod", type: "text", environments: ["Production"] },
      { id: "disabled", type: "text", environments: ["Disabled"] },
    ],
  }),
};

describe("site configuration", () => {
  it("uses the complete feedback form as the standard form", () => {
    const config = publicWidgetConfig({ ...site, widget_config: "{}" }, null);
    expect(config.blocks.map((block) => block.type)).toEqual([
      "title", "description", "reporter", "contact_email", "category",
      "element_picker", "metadata", "console_logs",
    ]);
    expect(config.blocks.find((block) => block.type === "description")?.required).toBe(true);
  });

  it("matches exact hosts and subdomains without matching suffix attacks", () => {
    const config = parseWidgetConfig(site.widget_config);
    expect(environmentForOrigin(config, "https://app.example.com")?.name).toBe("Production");
    expect(environmentForOrigin(config, "https://sub.app.example.com")?.name).toBe("Production");
    expect(environmentForOrigin(config, "https://app.example.com.evil.test")).toBeNull();
  });

  it("rejects disabled and unknown configured origins", () => {
    const config = parseWidgetConfig(site.widget_config);
    expect(originAllowed(config, "https://app.example.com")).toBe(true);
    expect(originAllowed(config, "https://disabled.example.com")).toBe(false);
    expect(originAllowed(config, "https://other.example.com")).toBe(false);
  });

  it("rejects an empty origin allowlist and reports delivery readiness", () => {
    expect(originAllowed(parseWidgetConfig("{}"), "https://app.example.com")).toBe(false);
    expect(siteReadiness(site)).toEqual({ lifecycle: "ready", ready: true, issues: [] });
    expect(siteReadiness({ ...site, project_repo: "other" }).issues).toContain("repository_mismatch");
  });

  it("returns only the effective environment and its blocks", () => {
    const config = publicWidgetConfig(site, "https://app.example.com");
    expect(config.buttonColor).toBe("#222222");
    expect(config.captureMode).toBe("screenshot");
    expect(config.environments).toHaveLength(1);
    expect(config.blocks.map((block) => block.id)).toEqual(["all", "prod"]);
  });

  it("uses central project branding for the widget while retaining environment overrides", () => {
    const branded = {
      ...site,
      branding_config: JSON.stringify({ branding: {
        name: "Playnist", logoUrl: "https://example.com/logo.svg", accentColor: "#ABCDEF",
        buttonText: "Send feedback", fontPreset: "playnist",
      } }),
    };
    const defaultConfig = publicWidgetConfig(branded, null);
    expect(defaultConfig).toMatchObject({
      buttonColor: "#ABCDEF",
      buttonText: "Send feedback",
      branding: { name: "Playnist", fontPreset: "playnist" },
    });
    expect(publicWidgetConfig(branded, "https://app.example.com").buttonColor).toBe("#222222");
  });

  it("keeps DOM selection enabled for existing environments", () => {
    const config = publicWidgetConfig({ ...site, widget_config: JSON.stringify({ environments: [{ name: "Production", url: "app.example.com" }] }) }, "https://app.example.com");
    expect(config.captureMode).toBe("dom");
  });

  it("returns independent launcher settings and safe defaults", () => {
    expect(publicWidgetConfig({ ...site, widget_config: "{}" }, null).launcher).toEqual({
      desktop: { style: "tab", position: "center-right" },
      mobile: { style: "button", position: "bottom-right" },
    });
    const configured = publicWidgetConfig({
      ...site,
      widget_config: JSON.stringify({ launcher: {
        desktop: { style: "button", position: "top-left" },
        mobile: { style: "tab", position: "center-left" },
      } }),
    }, null);
    expect(configured.launcher).toEqual({
      desktop: { style: "button", position: "top-left" },
      mobile: { style: "tab", position: "center-left" },
    });
  });
});
