import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/inactive-repos", () => ({
  getActiveRepoNames: vi.fn(async () => ["playnist"]),
}));
vi.mock("../search", () => ({
  onRequestGet: vi.fn(async () => Response.json({ results: [
    { id: "person:1", kind: "person", title: "Jasper", subtitle: "@jasper", login: "jasper" },
    { id: "feature:2", kind: "feature", title: "Ship API", subtitle: "Feature #2", login: null },
  ] })),
}));

import { onRequestGet as currentSummary } from "../v1/feed/current-summary";
import { onRequestGet as retrieveProject } from "../v1/projects/[id]/retrieval";

describe("NoxHere platform routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tracked people with project-scoped current-work counts", async () => {
    const db = {
      prepare() {
        return {
          bind() { return this; },
          async first() { return { data: JSON.stringify({ excludedMembers: ["hidden"] }) }; },
        };
      },
      async batch() {
        return [
          { results: [
            { login: "jasper", avatar_url: "https://example.com/jasper.png", kind: "human" },
            { login: "hidden", avatar_url: "https://example.com/hidden.png", kind: "human" },
          ] },
          { results: [
            { id: 1, repo: "playnist", number: 1, title: "One", state: "open", author: "JASPER", author_avatar: null, draft: 0, html_url: "https://example.com/pr/1", updated_at: "2026-10-08" },
            { id: 2, repo: "playnist", number: 2, title: "Two", state: "open", author: "jasper", author_avatar: null, draft: 1, html_url: "https://example.com/pr/2", updated_at: "2026-10-08" },
          ] },
          { results: [
            { id: 3, repo: "playnist", number: 3, title: "Three", state: "open", assignees_json: '[{"login":"jasper"}]', html_url: "https://example.com/issues/3", updated_at: "2026-10-08" },
          ] },
        ];
      },
    };
    const response = await currentSummary({ env: { DB: db }, data: { orgId: 7, orgLogin: "acme", projectId: "project-1" } } as never);
    await expect(response.json()).resolves.toMatchObject({
      members: [{ login: "jasper", avatar_url: "https://example.com/jasper.png", kind: "human" }],
      prs: [{ number: 1 }, { number: 2 }],
      issues: [{ number: 3, assignees: [{ login: "jasper" }] }],
      excludedMembers: ["hidden"],
      people: [{ member: { login: "jasper" }, counts: { prs: 2, issues: 1 } }],
    });
  });

  it("maps shared search results to owning NoxHere service routes", async () => {
    const response = await retrieveProject({
      env: { DB: {} },
      request: new Request("https://app.noxhere.com/api/v1/projects/project-1/retrieval?q=ship"),
      params: { id: "project-1" },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1" },
    } as never);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: "person:1", serviceId: "connect", href: "/acme/project-1/feed/current/jasper" }),
      expect.objectContaining({ id: "feature:2", serviceId: "ticket", href: "/acme/project-1/ticket/board" }),
    ]);
  });

  it("rejects a project path that differs from authenticated scope", async () => {
    const response = await retrieveProject({
      env: { DB: {} },
      request: new Request("https://app.noxhere.com/api/v1/projects/other/retrieval?q=ship"),
      params: { id: "other" },
      data: { orgId: 7, orgLogin: "acme", projectId: "project-1" },
    } as never);
    expect(response.status).toBe(403);
  });
});
