import { describe, expect, it, vi } from "vitest";
import { demoConstants, handleDemoRequest } from "./demo.js";

function dbForSession({ valid = true } = {}) {
  const statement = {
    bind: vi.fn(() => statement),
    run: vi.fn(async () => ({ success: true })),
    first: vi.fn(async () => valid ? { valid: 1 } : null),
  };
  return { prepare: vi.fn(() => statement) };
}

describe("NoxFeed demo API", () => {
  it("creates a short-lived read-only demo session", async () => {
    const response = await handleDemoRequest(
      new Request("https://demo.test/api/demo/session", { method: "POST" }),
      dbForSession(),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: "demo", read_only: true });
    expect(body.account.login).toBe(demoConstants.login);
    expect(body.organization.login).toBe(demoConstants.org);
    expect(body.access_token.length).toBeGreaterThan(40);
  });

  it("rejects missing demo authorization", async () => {
    const response = await handleDemoRequest(
      new Request("https://demo.test/api/v1/me"),
      dbForSession({ valid: false }),
    );
    expect(response.status).toBe(401);
  });

  it("keeps production-like write routes visible but read-only", async () => {
    const response = await handleDemoRequest(
      new Request("https://demo.test/api/v1/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${"x".repeat(50)}` },
      }),
      dbForSession(),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "demo_read_only" });
  });

  it("returns compact eight-card feed pages for the larger fixture", async () => {
    const auth = {
      bind: vi.fn(() => auth),
      first: vi.fn(async () => ({ valid: 1 })),
    };
    const rows = Array.from({ length: 9 }, (_, offset) => ({
      id: 100 - offset,
      type: "pr_narrative",
      source: "github",
      actor_id: "actor-reviewer",
      project_id: "project-care-api",
      org: demoConstants.org,
      repo: "care-api",
      summary: `Demo card ${offset + 1}`,
      age_seconds: offset * 60,
      payload_json: "{}",
    }));
    const events = {
      bind: vi.fn(() => events),
      all: vi.fn(async () => ({ results: rows })),
    };
    const db = { prepare: vi.fn()
      .mockReturnValueOnce(auth)
      .mockReturnValueOnce(events) };

    const response = await handleDemoRequest(
      new Request("https://demo.test/api/v1/events?type=pr_narrative&limit=50", {
        headers: { Authorization: `Bearer ${"x".repeat(50)}` },
      }),
      db,
    );
    const body = await response.json();
    expect(body.events).toHaveLength(8);
    expect(body.nextCursor).toBe("93");
    expect(events.bind).toHaveBeenCalledWith("pr_narrative", 9);
  });

  it("searches every demo data type in one request", async () => {
    const auth = { bind: vi.fn(() => auth), first: vi.fn(async () => ({ valid: 1 })) };
    const statements = Array.from({ length: 4 }, () => {
      const statement = { bind: vi.fn(() => statement) };
      return statement;
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(auth)
        .mockReturnValueOnce(statements[0])
        .mockReturnValueOnce(statements[1])
        .mockReturnValueOnce(statements[2])
        .mockReturnValueOnce(statements[3]),
      batch: vi.fn(async () => [
        { results: [{ login: "alex-demo", avatar_url: null }] },
        { results: [{ id: 87, repo: "activity-api", number: 87, title: "Alex search", state: "open", author: "alex-demo", updated_age_seconds: 10 }] },
        { results: [] },
        { results: [{ id: 1189, repo: "team-dashboard", pr_number: 51, type: "narrative", summary: "Alex shipped search", age_seconds: 20 }] },
      ]),
    };

    const response = await handleDemoRequest(
      new Request("https://demo.test/api/v1/search?q=alex", {
        headers: { Authorization: `Bearer ${"x".repeat(50)}` },
      }),
      db,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results.map((result) => result.kind)).toEqual(["person", "pull_request", "post"]);
    expect(db.batch).toHaveBeenCalledOnce();
  });
});
