import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/github-app.js", () => ({
  getInstallationToken: vi.fn(async () => "installation-token"),
}));
vi.mock("../../lib/actors.js", () => ({
  resolveActorFromGithub: vi.fn(async () => ({ id: "actor_alex", name: "Alex", tone: "plain" })),
}));

import { onRequestPost } from "../projects/[id]/backfill-prs.js";
import { getInstallationToken } from "../../lib/github-app.js";

afterEach(() => vi.restoreAllMocks());

describe("pull-request post backfill dependencies", () => {
  it("uses the authenticated admin token when the core API has no GitHub App key", async () => {
    vi.mocked(getInstallationToken).mockRejectedValueOnce(new Error("GitHub App env vars missing"));
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const DB = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM projects")) {
              return { id: "project-1", name: "App", org: "acme", repo: "app", owner_id: "acme" };
            }
            if (sql.includes("FROM installations")) return { installation_id: 123 };
            return null;
          },
          async all() { return { results: [] }; },
        };
      },
    };
    const response = await onRequestPost({
      env: { DB },
      data: { orgId: 1, orgLogin: "acme", token: "user-token", isAdmin: true },
      params: { id: "project-1" },
      request: new Request("https://example.com/api/v1/projects/project-1/backfill-prs", {
        method: "POST",
        body: JSON.stringify({ days: 2 }),
      }),
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ found: 0, queued: 0 });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/repos/acme/app/pulls"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer user-token" }) }),
    );
  });

  it("does not queue a PR that already has a release note", async () => {
    const recent = new Date().toISOString();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      number: 42,
      title: "Already released",
      user: { login: "alex" },
      created_at: recent,
      updated_at: recent,
      merged_at: recent,
      closed_at: recent,
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    const DB = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM projects")) {
              return { id: "project-1", name: "App", org: "acme", repo: "app", owner_id: "acme" };
            }
            if (sql.includes("FROM installations")) return { installation_id: 123 };
            return null;
          },
          async all() {
            if (sql.includes("type = 'release_notes'")) return { results: [{ repo: "app", pr_number: 42 }] };
            return { results: [] };
          },
        };
      },
    };
    const waitUntil = vi.fn();
    const response = await onRequestPost({
      env: { DB },
      data: { orgId: 1, orgLogin: "acme", token: "user-token", isAdmin: true },
      params: { id: "project-1" },
      request: new Request("https://example.com/api/v1/projects/project-1/backfill-prs", {
        method: "POST",
        body: JSON.stringify({ days: 2 }),
      }),
      waitUntil,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ found: 1, queued: 0, skipped: 1 });
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("scans every repository assigned to the logical project", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const DB = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM projects")) {
              return { id: "project-1", name: "App", org: "acme", repo: "app", owner_id: "acme" };
            }
            if (sql.includes("FROM installations")) return { installation_id: 123 };
            return null;
          },
          async all() {
            if (sql.includes("FROM project_repositories")) {
              return { results: [{ repo: "app" }, { repo: "components" }] };
            }
            return { results: [] };
          },
        };
      },
    };
    const response = await onRequestPost({
      env: { DB },
      data: { orgId: 1, orgLogin: "acme", token: "user-token", isAdmin: true },
      params: { id: "project-1" },
      request: new Request("https://example.com/api/v1/projects/project-1/backfill-prs", {
        method: "POST",
        body: JSON.stringify({ days: 2 }),
      }),
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      expect.stringContaining("/repos/acme/app/pulls"),
      expect.stringContaining("/repos/acme/components/pulls"),
    ]));
  });

  it("persists the PR and queues generation durably before returning", async () => {
    const recent = new Date().toISOString();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      number: 42,
      title: "Improve login",
      user: { login: "alex", id: 7, type: "User" },
      created_at: recent,
      updated_at: recent,
      merged_at: recent,
      closed_at: recent,
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    const DB = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM projects")) {
              return { id: "project-1", name: "App", org: "acme", repo: "app", owner_id: "acme" };
            }
            if (sql.includes("FROM installations")) return { installation_id: 123 };
            return null;
          },
          async all() { return { results: [] }; },
          async run() { return { meta: { last_row_id: 100 } }; },
        };
      },
    };
    const send = vi.fn(async () => undefined);
    const waitUntil = vi.fn();
    const response = await onRequestPost({
      env: { DB, TASK_QUEUE: { send } },
      data: { orgId: 1, orgLogin: "acme", token: "user-token", isAdmin: true },
      params: { id: "project-1" },
      request: new Request("https://example.com/api/v1/projects/project-1/backfill-prs", {
        method: "POST",
        body: JSON.stringify({ days: 2 }),
      }),
      waitUntil,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ found: 1, queued: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "narrate",
      eventId: 100,
      ownerId: "acme",
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "release_notes",
      eventId: 100,
      ownerId: "acme",
    }));
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("returns a sanitized dependency error when Activity generation info is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recent = new Date().toISOString();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      number: 42,
      title: "Improve login",
      user: { login: "alex" },
      created_at: recent,
      updated_at: recent,
      merged_at: null,
      closed_at: null,
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));

    const DB = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM projects")) {
              return { id: "project-1", name: "App", org: "acme", repo: "app", owner_id: "acme" };
            }
            if (sql.includes("FROM installations")) return { installation_id: 123 };
            return null;
          },
          async all() { return { results: [] }; },
        };
      },
    };
    const context = {
      env: {
        DB,
        ACTIVITY_RESPONSE: {
          async generationInfo() { throw new Error("secret internal binding detail"); },
        },
      },
      data: { orgId: 1, orgLogin: "acme", isAdmin: true },
      params: { id: "project-1" },
      request: new Request("https://example.com/api/v1/projects/project-1/backfill-prs", {
        method: "POST",
        body: JSON.stringify({ rewriteOtherModels: true }),
      }),
      waitUntil: vi.fn(),
    };

    const response = await onRequestPost(context);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Activity generation service is unavailable",
      code: "dependency_unavailable",
    });
    expect(context.waitUntil).not.toHaveBeenCalled();
  });
});
