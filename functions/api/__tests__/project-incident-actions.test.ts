import { describe, expect, it } from "vitest";
import { onRequestGet, onRequestPatch } from "../v1/projects/[id]/incidents/[incidentId]";

const INCIDENT_ID = "inc_0123456789abcdef0123456789abcdef";

function fixture(options: { projectId?: string; isAdmin?: boolean; row?: Record<string, unknown> | null } = {}) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const returned = options.row === undefined ? {
    id: INCIDENT_ID,
    source_id: "source-1",
    source_name: "Playnist Production",
    fingerprint: "error.occurred/browser.fetch/http_502/get_api_feeds_discover_failed",
    title: "Discover failed",
    error_code: "http_502",
    component: "browser.fetch",
    environment: "production",
    first_seen_at: "2026-09-25T00:00:00.000Z",
    last_seen_at: "2026-09-26T00:00:00.000Z",
    occurrence_count: 3,
    status: "resolved",
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: "2026-09-26T00:00:00.000Z",
    resolved_by: "jasper",
  } : options.row;
  const db = { prepare(sql: string) { const statement = {
    bind(...binds: unknown[]) { calls.push({ sql, binds }); return statement; },
    async first() { return returned; },
  }; return statement; } };
  return {
    calls,
    context: {
      env: { DB: db },
      data: {
        orgId: 7,
        projectId: options.projectId ?? "proj_playnist",
        userLogin: "jasper",
        isAdmin: options.isAdmin ?? true,
        auth: { type: "session" },
      },
      params: { id: "proj_playnist", incidentId: INCIDENT_ID },
      request: new Request(`https://app.noxhere.com/api/v1/projects/proj_playnist/incidents/${INCIDENT_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      }),
    },
  };
}

describe("project incident actions", () => {
  it("reads a resolved incident by opaque ID within the authenticated project", async () => {
    const test = fixture();
    test.context.request = new Request(test.context.request.url);
    const response = await onRequestGet(test.context as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { incident: Record<string, unknown> };
    expect(body.incident).toMatchObject({
      id: INCIDENT_ID,
      sourceName: "Playnist Production",
      status: "resolved",
      occurrenceCount: 3,
    });
    expect(test.calls[0].sql).toContain("incident.id = ?");
    expect(test.calls[0].binds).toEqual([INCIDENT_ID, 7, 7, "proj_playnist"]);
  });

  it("does not reveal incident reads outside the authenticated project", async () => {
    const mismatch = fixture({ projectId: "proj_other" });
    expect((await onRequestGet(mismatch.context as never)).status).toBe(404);
    expect(mismatch.calls).toHaveLength(0);

    const absent = fixture({ row: null });
    expect((await onRequestGet(absent.context as never)).status).toBe(404);
  });

  it("updates by opaque incident ID while preserving slash-containing fingerprints as data", async () => {
    const test = fixture();
    const response = await onRequestPatch(test.context as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { incident: { id: string; fingerprint: string; status: string } };
    expect(body.incident).toMatchObject({ id: INCIDENT_ID, status: "resolved" });
    expect(body.incident.fingerprint).toContain("/");
    expect(test.calls[0].sql).toContain("WHERE id = ?");
    expect(test.calls[0].sql).not.toContain("fingerprint = ?");
    expect(test.calls[0].binds).toContain(INCIDENT_ID);
  });

  it("does not reveal incidents outside the authenticated project", async () => {
    const mismatch = fixture({ projectId: "proj_other" });
    expect((await onRequestPatch(mismatch.context as never)).status).toBe(404);
    expect(mismatch.calls).toHaveLength(0);

    const absent = fixture({ row: null });
    expect((await onRequestPatch(absent.context as never)).status).toBe(404);
  });

  it("requires an admin session and validates status", async () => {
    expect((await onRequestPatch(fixture({ isAdmin: false }).context as never)).status).toBe(403);
    const invalid = fixture();
    invalid.context.request = new Request(invalid.context.request.url, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "fixed" }),
    });
    expect((await onRequestPatch(invalid.context as never)).status).toBe(400);
  });
});
