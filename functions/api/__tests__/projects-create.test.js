import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/inactive-repos.js", () => ({
  getActiveRepoNames: vi.fn(async () => ["api", "web"]),
}));

import { onRequestPost } from "../projects.js";

function context({ isAdmin = true, name = "Client portal", duplicate = null, repositories, enabledAssignments = [] } = {}) {
  const statements = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("SELECT id FROM projects")) return duplicate;
          if (sql.includes("SELECT data FROM config")) return { data: JSON.stringify({ apps: { noxspot: false } }) };
          return null;
        },
        async all() {
          if (sql.includes("FROM project_repositories assignment")) return { results: enabledAssignments.map((repo) => ({ repo })) };
          return { results: [] };
        },
      };
      statements.push(statement);
      return statement;
    },
    batch: vi.fn(async () => []),
  };
  return {
    db,
    statements,
    value: {
      request: new Request("https://app.noxhere.com/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(repositories === undefined ? {} : { repositories }) }),
      }),
      env: { DB: db },
      data: { orgId: 7, orgLogin: "acme", isAdmin },
    },
  };
}

describe("project creation", () => {
  it("creates a project with every available repository and capability by default", async () => {
    const state = context();
    const response = await onRequestPost(state.value);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.project).toMatchObject({
      name: "Client portal",
      slug: "client-portal",
      org: "acme",
      repo: null,
      routing_enabled: 1,
      repositories: ["api", "web"],
    });
    expect(body.project).not.toHaveProperty("enabled_services");
    expect(body.project.id).toMatch(/^proj_acme_client-portal_[a-f0-9-]{8}$/);
    expect(state.db.batch).toHaveBeenCalledTimes(1);
    expect(state.db.batch.mock.calls[0][0]).toHaveLength(4);
  });

  it("does not take repositories from another enabled project by default", async () => {
    const state = context({ enabledAssignments: ["api"] });
    const response = await onRequestPost(state.value);
    expect(response.status).toBe(201);
    expect((await response.json()).project.repositories).toEqual(["web"]);
  });

  it("uses the repository selection supplied during onboarding", async () => {
    const state = context({ repositories: ["web"] });
    const response = await onRequestPost(state.value);
    expect(response.status).toBe(201);
    expect((await response.json()).project.repositories).toEqual(["web"]);
    expect(state.db.batch.mock.calls[0][0]).toHaveLength(3);
  });

  it("requires an organization admin", async () => {
    const response = await onRequestPost(context({ isAdmin: false }).value);
    expect(response.status).toBe(403);
  });

  it("rejects duplicate active project names", async () => {
    const response = await onRequestPost(context({ duplicate: { id: "existing" } }).value);
    expect(response.status).toBe(409);
  });
});
