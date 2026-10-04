import { describe, expect, it } from "vitest";
import { onRequestGet, onRequestPut } from "../v1/projects/[id]/cue/actions";

function makeDb(rows: Array<{ metric_key: string; label: string; template_slot: number | null }> = []) {
  const writes: Array<{ sql: string; binds: unknown[] }> = [];
  return {
    prepare(sql: string) {
      return {
        sql, binds: [] as unknown[],
        bind(...values: unknown[]) { this.binds = values; return this; },
        async all() {
          if (sql.includes("template_slot IS NOT NULL")) return { results: rows.filter((row) => row.template_slot != null) };
          if (sql.includes("LIMIT 3")) return { results: rows.slice(0, 3).map((row) => ({ ...row, template_slot: null })) };
          return { results: [] };
        },
        async first() { return null; },
      };
    },
    async batch(statements: Array<{ sql: string; binds: unknown[] }>) {
      writes.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
    writes,
  };
}

function context(db: ReturnType<typeof makeDb>, body?: unknown, isAdmin = true) {
  return {
    env: { DB: db }, params: { id: "playnist" },
    data: { orgId: 2, projectId: "playnist", userLogin: "jasper", isAdmin },
    request: new Request("https://app.noxhere.com/api/v1/projects/playnist/cue/actions", {
      method: body === undefined ? "GET" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  };
}

const actions = [
  { key: "custom.comments.written", label: "Comments written" },
  { key: "custom.journals.added", label: "Journals added" },
  { key: "custom.reviews.written", label: "Reviews written" },
];

describe("NoxCue engagement action template", () => {
  it("uses existing custom metrics as a zero-setup draft", async () => {
    const db = makeDb(actions.map((action) => ({ metric_key: action.key, label: action.label, template_slot: null })));
    const response = await onRequestGet(context(db) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      projectId: "playnist",
      actions: expect.arrayContaining([expect.objectContaining({ slot: 1, key: "custom.comments.written" })]),
      snippet: expect.stringContaining('noxCue.activity("custom.comments.written"'),
    }));
  });

  it("atomically registers and orders all three actions", async () => {
    const db = makeDb();
    const response = await onRequestPut(context(db, { actions, windowDays: 14 }) as never);
    expect(response.status).toBe(200);
    expect(db.writes).toHaveLength(8);
    expect((await response.clone().json() as { windowDays: number }).windowDays).toBe(14);
    expect(db.writes.filter((write) => write.sql.includes("template_slot = ?")).map((write) => write.binds[1])).toEqual([1, 2, 3]);
  });

  it("requires one to three unique custom keys and admin mutation access", async () => {
    expect((await onRequestPut(context(makeDb(), { actions: [], windowDays: 7 }) as never)).status).toBe(400);
    expect((await onRequestPut(context(makeDb(), { actions: [actions[0], actions[0]], windowDays: 7 }) as never)).status).toBe(400);
    expect((await onRequestPut(context(makeDb(), { actions, windowDays: 90 }) as never)).status).toBe(400);
    expect((await onRequestPut(context(makeDb(), { actions, windowDays: 7 }, false) as never)).status).toBe(403);
  });
});
