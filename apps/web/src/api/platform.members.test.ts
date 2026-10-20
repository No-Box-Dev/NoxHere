import { afterEach, describe, expect, it, vi } from "vitest";
import { platformApi } from "./platform";

afterEach(() => vi.unstubAllGlobals());

describe("platform membership bootstrap", () => {
  it("keeps the organization directory out of project bootstrap", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const bodies: Record<string, unknown> = {
        "/api/v1/bootstrap": {
          apiVersion: 1,
          actor: { id: "owner", name: "owner", initials: "OW", accessLevel: "member", role: "admin", capabilities: ["organization.manage"], isAdmin: true, allowedServiceIds: [] },
          organization: { id: "acme", name: "acme" },
          projects: [{ id: "project-1", name: "Project one", organizationId: "acme", environment: "production", connections: [] }],
        },
      };
      if (!(path in bodies)) throw new Error(`Unexpected request to ${path}`);
      return new Response(JSON.stringify(bodies[path]), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await platformApi.bootstrap("acme", "project-1");

    expect(result.projects[0]).not.toHaveProperty("members");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/members"), expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/bootstrap", expect.objectContaining({
      headers: expect.objectContaining({ "X-Org": "acme", "X-Project-ID": "project-1" }),
    }));
  });

  it("loads the shared member directory with project authorization scope", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { login: "owner", avatar_url: "https://example.com/owner.png", kind: "human" },
      { login: "member", avatar_url: "https://example.com/member.png", kind: "human" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(platformApi.members("acme", "project-1")).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/members", expect.objectContaining({
      headers: expect.objectContaining({ "X-Org": "acme", "X-Project-ID": "project-1" }),
    }));
  });
});
