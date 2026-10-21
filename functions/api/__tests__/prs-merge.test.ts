import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/github-app.js", () => ({
  getInstallationIdForOrg: vi.fn(async () => 12345),
  getInstallationToken: vi.fn(async () => "install-token"),
}));

import { onRequestPost } from "../prs/merge";
import { getInstallationIdForOrg, getInstallationToken } from "../../lib/github-app.js";

function database() {
  const runs: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    prepare(sql: string) {
      const statement = {
        bindings: [] as unknown[],
        bind(...bindings: unknown[]) { statement.bindings = bindings; return statement; },
        async run() { runs.push({ sql, bindings: statement.bindings }); return { meta: { changes: 1 } }; },
      };
      return statement;
    },
    runs,
  };
}

function context(body: unknown, isAdmin = true) {
  const db = database();
  return {
    request: new Request("https://app.noxhere.com/api/v1/prs/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env: { DB: db },
    data: { orgId: 7, orgLogin: "acme", isAdmin },
    db,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(getInstallationIdForOrg).mockResolvedValue(12345);
  vi.mocked(getInstallationToken).mockResolvedValue("install-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/v1/prs/merge", () => {
  it("requires an administrator", async () => {
    const response = await onRequestPost(context({ repo: "web", number: 42 }, false) as never);
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates the requested merge method", async () => {
    const response = await onRequestPost(context({ repo: "web", number: 42, method: "force" }) as never);
    expect(response.status).toBe(400);
  });

  it("merges the current GitHub head and mirrors the result", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ state: "open", merged: false, head: { sha: "head-123" } }))
      .mockResolvedValueOnce(Response.json({ merged: true, message: "Pull Request successfully merged", sha: "merge-456" }));
    const value = context({ repo: "web", number: 42, method: "rebase" });

    const response = await onRequestPost(value as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, repo: "web", number: 42, state: "merged", method: "rebase", sha: "merge-456" });
    expect(fetch).toHaveBeenNthCalledWith(2,
      "https://api.github.com/repos/acme/web/pulls/42/merge",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ merge_method: "rebase", sha: "head-123" }),
        headers: expect.objectContaining({ Authorization: "Bearer install-token" }),
      }),
    );
    expect(value.db.runs).toHaveLength(1);
    expect(value.db.runs[0].sql).toContain("merged_at");
    expect(value.db.runs[0].bindings).toEqual([7, "web", 42]);
  });

  it("surfaces GitHub ruleset and check failures without changing D1", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ state: "open", merged: false, head: { sha: "head-123" } }))
      .mockResolvedValueOnce(Response.json({ merged: false, message: "Required status check has not succeeded" }, { status: 405 }));
    const value = context({ repo: "web", number: 42 });

    const response = await onRequestPost(value as never);

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: "Required status check has not succeeded" });
    expect(value.db.runs).toHaveLength(0);
  });

  it("fails safely when the PR head cannot be read", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: "Not Found" }, { status: 404 }));
    const response = await onRequestPost(context({ repo: "web", number: 42 }) as never);
    expect(response.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
