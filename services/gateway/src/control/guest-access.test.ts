import { describe, expect, it } from "vitest";
import { GUEST_SERVICES, guestCanAccess, loadGuestAccess } from "./guest-access";
import { requestProjectId, validateGuestRequest } from "./auth";

function dbWithGrants(results: unknown[]): D1Database {
  return {
    prepare() {
      const statement = {
        bind() { return statement; },
        async all() { return { results }; },
      };
      return statement;
    },
  } as unknown as D1Database;
}

describe("guest access", () => {
  const servicePaths = {
    noxticket: "/api/v1/features",
    noxfeed: "/api/v1/feed",
    noxspot: "/api/v1/spots/sites",
    noxcue: "/api/v1/cues/sources",
  } as const;

  it("combines tool grants and lets a project grant override them", async () => {
    const loaded = await loadGuestAccess(dbWithGrants([
      { id: "one", scope_type: "tool", project_id: "p1", service: "noxspot" },
      { id: "two", scope_type: "tool", project_id: "p1", service: "noxcue" },
      { id: "three", scope_type: "project", project_id: "p2", service: null },
    ]), "principal", 7);

    expect(loaded?.access).toEqual({
      organizationWide: false,
      projects: { p1: ["noxspot", "noxcue"], p2: null },
    });
    expect(guestCanAccess(loaded!.access, "p1", "noxspot")).toBe(true);
    expect(guestCanAccess(loaded!.access, "p1", "noxfeed")).toBe(false);
    expect(guestCanAccess(loaded!.access, "p2", "noxticket")).toBe(true);
  });

  it("makes an organization invite valid for every project and tool", async () => {
    const loaded = await loadGuestAccess(dbWithGrants([
      { id: "org", scope_type: "organization", project_id: null, service: null },
    ]), "principal", 7);
    expect(guestCanAccess(loaded!.access, "any-project", "noxfeed")).toBe(true);
  });

  it("returns null when the identity has no active invitation grants", async () => {
    await expect(loadGuestAccess(dbWithGrants([]), "principal", 7)).resolves.toBeNull();
  });

  it("allows organization-wide guest reads without a project selector", () => {
    for (const service of GUEST_SERVICES) {
      const request = new Request(`https://app.noxhere.com${servicePaths[service]}`, { headers: { "X-Org": "acme" } });
      expect(validateGuestRequest(request, { organizationWide: true, projects: {} })).toBeNull();
    }
  });

  it("applies the same optional project boundary to every guest service", async () => {
    for (const service of GUEST_SERVICES) {
      const path = servicePaths[service];
      const access = { organizationWide: false, projects: { p1: null } };
      const missing = validateGuestRequest(new Request(`https://app.noxhere.com${path}`), access);
      expect(missing?.status).toBe(400);
      await expect(missing?.json()).resolves.toMatchObject({ error: { code: "project_required" } });

      const granted = new Request(`https://app.noxhere.com${path}`, { headers: { "X-Project-ID": "p1" } });
      expect(validateGuestRequest(granted, access)).toBeNull();

      const denied = validateGuestRequest(
        new Request(`https://app.noxhere.com${path}`, { headers: { "X-Project-ID": "p2" } }),
        access,
      );
      expect(denied?.status).toBe(404);
      await expect(denied?.json()).resolves.toMatchObject({ error: { code: "resource_not_found" } });
    }
  });

  it("requires a selector for a project-restricted guest", async () => {
    const request = new Request("https://app.noxhere.com/api/v1/feed", { headers: { "X-Org": "acme" } });
    const response = validateGuestRequest(request, { organizationWide: false, projects: { p1: null } });
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: "project_required" } });
  });

  it("accepts header, query, and path project selectors", () => {
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/feed?project_id=p1"))).toBe("p1");
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/cues/projects/p2/metrics"))).toBe("p2");
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/projects/p4/routing"))).toBe("p4");
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/feed", { headers: { "X-Project-ID": "p3" } }))).toBe("p3");
  });

  it("does not interpret project collection routes as project IDs", () => {
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/projects/routing"))).toBeNull();
    expect(requestProjectId(new Request("https://app.noxhere.com/api/v1/projects?view=bootstrap"))).toBeNull();
  });
});
