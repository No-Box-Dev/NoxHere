import { afterEach, describe, expect, it, vi } from "vitest";
import { platformApi } from "./platform";

afterEach(() => vi.unstubAllGlobals());

describe("platform membership bootstrap", () => {
  it("uses verified organization members and excludes actors and bots", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const bodies: Record<string, unknown> = {
        "/api/v1/me": { login: "owner", org: "acme", accessLevel: "member", isAdmin: true },
        "/api/v1/projects?view=bootstrap": { projects: [{ id: "project-1", name: "Project one", org: "acme", repo: "project-one", archived: 0, routing_enabled: 1 }] },
        "/api/v1/members": [
          { login: "owner", avatar_url: "https://example.com/owner.png", kind: "human" },
          { login: "member", avatar_url: "https://example.com/member.png", kind: "human" },
          { login: "repo-guest", avatar_url: "https://example.com/guest.png", kind: "contributor" },
          { login: "automation[bot]", avatar_url: "https://example.com/bot.png", kind: "bot" },
        ],
        "/api/v1/integrations/connections?view=bootstrap": { github: { connected: true }, slack: { connected: false } },
      };
      if (!(path in bodies)) throw new Error(`Unexpected request to ${path}`);
      return new Response(JSON.stringify(bodies[path]), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await platformApi.bootstrap("acme", "project-1");

    expect(result.projects[0]?.members).toEqual([
      { login: "owner", avatarUrl: "https://example.com/owner.png", role: "admin" },
      { login: "member", avatarUrl: "https://example.com/member.png", role: "member" },
    ]);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/actors"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me", expect.objectContaining({
      headers: expect.objectContaining({ "X-Org": "acme", "X-Project-ID": "project-1" }),
    }));
  });
});
