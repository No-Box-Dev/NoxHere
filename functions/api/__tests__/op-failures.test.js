import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/task-quarantine.js", () => ({ requeueQuarantinedTask: vi.fn() }));

import { onRequestGet, onRequestPost } from "../op-failures.js";
import { requeueQuarantinedTask } from "../../lib/task-quarantine.js";

function makeDb(rows = []) {
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn().mockReturnValue({ all });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, _bind: bind };
}

function makeCtx({
  url = "http://x/api/op-failures",
  isAdmin = true,
  orgLogin = "acme",
  rows = [],
} = {}) {
  const DB = makeDb(rows);
  return {
    ctx: {
      request: new Request(url, { method: "GET" }),
      env: { DB },
      data: { orgId: 1, orgLogin, isAdmin },
    },
    DB,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/op-failures", () => {
  it("403s when caller is not admin", async () => {
    const { ctx, DB } = makeCtx({ isAdmin: false });
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(403);
    expect(DB.prepare).not.toHaveBeenCalled();
  });

  it("400s when orgLogin is missing", async () => {
    const { ctx } = makeCtx({ orgLogin: null });
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
  });

  it("returns recent failures for the org", async () => {
    const sample = [
      {
        id: 2,
        op: "narrateEvent",
        delivery_id: "abc",
        error: "rate limited",
        occurred_at: "2026-05-20T10:00:00",
      },
      {
        id: 1,
        op: "task:sync_repo",
        delivery_id: "repo#1",
        error: "boom",
        occurred_at: "2026-05-20T09:00:00",
      },
    ];
    const { ctx, DB } = makeCtx({ rows: sample });
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failures).toEqual(sample);
    expect(body.quarantined).toEqual(sample);
    expect(DB._bind).toHaveBeenCalledWith("acme", 25);
  });

  it("clamps limit to 100", async () => {
    const { ctx, DB } = makeCtx({ url: "http://x/api/op-failures?limit=9999" });
    await onRequestGet(ctx);
    expect(DB._bind).toHaveBeenCalledWith("acme", 100);
  });

  it("floors limit at 1", async () => {
    const { ctx, DB } = makeCtx({ url: "http://x/api/op-failures?limit=0" });
    await onRequestGet(ctx);
    // 0 falls through to DEFAULT_ROWS=25, since Number("0") || 25 === 25
    expect(DB._bind).toHaveBeenCalledWith("acme", 25);
  });
});

describe("POST /api/op-failures", () => {
  it("requeues one organization-scoped quarantined task", async () => {
    requeueQuarantinedTask.mockResolvedValueOnce({ status: "requeued", id: 7 });
    const { ctx } = makeCtx();
    ctx.request = new Request("http://x/api/op-failures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quarantineId: 7 }),
    });
    ctx.env.TASK_QUEUE = { send: vi.fn() };
    const response = await onRequestPost(ctx);
    expect(response.status).toBe(202);
    expect(requeueQuarantinedTask).toHaveBeenCalledWith(ctx.env.DB, ctx.env.TASK_QUEUE, "acme", 7);
  });

  it("does not expose another organization or an already recovered task", async () => {
    requeueQuarantinedTask.mockResolvedValueOnce({ status: "not_found" });
    const { ctx } = makeCtx();
    ctx.request = new Request("http://x/api/op-failures", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quarantineId: 9 }),
    });
    ctx.env.TASK_QUEUE = { send: vi.fn() };
    expect((await onRequestPost(ctx)).status).toBe(404);
  });
});
