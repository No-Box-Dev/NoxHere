import { describe, expect, it, vi } from "vitest";
import {
  apiTokenProjectResource,
  canReadProjectResource,
  projectScopedApiTokenPathSupported,
} from "../api-auth.js";

describe("API authentication primitives", () => {
  it("allows only resource-safe project token routes", () => {
    expect(projectScopedApiTokenPathSupported("/api/v1/feed", "GET")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/v1/developer-feedback", "POST")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/v1/integrations/slack/messages", "POST")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/spots/sites/site-1", "PATCH")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/v1/spots/sites/site-1", "PATCH")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/cues/sources/source-1/keys", "POST")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/v1/cues/sources/source-1/keys", "POST")).toBe(true);
    expect(projectScopedApiTokenPathSupported("/api/v1/services/noxfeed/config", "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/llm-settings", "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/features", "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/v1/features", "GET")).toBe(false);
  });

  it("admits pre-scoped API tokens to project reads without promoting human members", () => {
    expect(canReadProjectResource({ isAdmin: true, auth: { type: "session" } })).toBe(true);
    expect(canReadProjectResource({ isAdmin: false, auth: { type: "api_token" } })).toBe(true);
    expect(canReadProjectResource({ isAdmin: false, auth: { type: "session" } })).toBe(false);
    expect(canReadProjectResource({ isAdmin: false })).toBe(false);
  });

  it("resolves duplicate feature numbers inside the selected project", async () => {
    const prepare = vi.fn();

    await expect(apiTokenProjectResource(
      { prepare } as never,
      "/api/v1/features/1",
      7,
      new URLSearchParams(),
      "project-playnist",
    )).resolves.toEqual({ kind: "resource", projectId: "project-playnist" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("resolves canonical project routing writes to the project rather than the routing segment", async () => {
    await expect(apiTokenProjectResource(
      {} as never,
      "/api/v1/projects/proj_no-box-dev_noxhere/routing",
      7,
    )).resolves.toEqual({ kind: "project", projectId: "proj_no-box-dev_noxhere" });
  });

});
