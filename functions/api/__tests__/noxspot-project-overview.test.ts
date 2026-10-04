import { describe, expect, it } from "vitest";
import { onRequestGet } from "../spots/project-overview";

function makeDb() {
  const preparedSql: string[] = [];
  return {
    preparedSql,
    prepare(sql: string) {
      preparedSql.push(sql);
      return {
        sql,
        binds: [] as unknown[],
        bind(...values: unknown[]) { this.binds = values; return this; },
        async first() {
          if (sql.includes("FROM projects")) return { id: "playnist", name: "Playnist", repo: "playnist" };
          return null;
        },
        async all() {
          if (sql.includes("JOIN project_repositories assignment")) return { results: [{ name: "playnist" }, { name: "playnist-api" }] };
          return { results: [] };
        },
      };
    },
    async batch(statements: Array<{ sql: string }>) {
      return statements.map(({ sql }) => {
        if (sql.includes("FROM issues")) return { results: [{
          id: 2000,
          repo: "playnist",
          number: 2000,
          title: "Closed GitHub issue",
          body: "Reported issue",
          state: "closed",
          author: "reporter",
          author_avatar: null,
          created_at: "2026-09-19T00:00:00Z",
          updated_at: "2026-09-20T00:00:00Z",
          closed_at: "2026-09-20T00:00:00Z",
          html_url: "https://github.com/No-Box-Dev/playnist/issues/2000",
          assignees_json: "[]",
          labels_json: '[{"name":"noxspot"}]',
        }, {
          id: 2001,
          repo: "playnist",
          number: 2001,
          title: "Regular GitHub issue",
          body: "Created directly in GitHub",
          state: "open",
          author: "maintainer",
          author_avatar: null,
          created_at: "2026-09-20T01:00:00Z",
          updated_at: "2026-09-20T01:00:00Z",
          closed_at: null,
          html_url: "https://github.com/No-Box-Dev/playnist/issues/2001",
          assignees_json: "[]",
          labels_json: '[{"name":"bug"}]',
        }] };
        if (sql.includes("FROM spot_reports\n")) return { results: [{
          id: "report-2000",
          repo: "playnist",
          issue_number: 2000,
          status: "open",
          resolution_summary: null,
          resolved_at: null,
          resolved_by: null,
          notification_consent: 1,
          notification_status: "not_requested",
          notification_last_error: null,
          notification_attempts: 0,
          last_notified_at: null,
        }] };
        return { results: [] };
      });
    },
  };
}

describe("NoxSpot project overview", () => {
  it("treats the mirrored GitHub issue state as authoritative", async () => {
    const db = makeDb();
    const response = await onRequestGet({
      env: { DB: db },
      data: { orgId: 2, orgLogin: "No-Box-Dev", projectId: "playnist" },
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json() as { counts: { open: number; resolved: number }; issues: Array<{ number: number; source: string; reportStatus: string; resolvedAt: string }> };
    expect(body.counts).toEqual(expect.objectContaining({ open: 1, resolved: 1 }));
    expect(body.issues[0]).toEqual(expect.objectContaining({
      source: "noxspot",
      reportStatus: "resolved",
      resolvedAt: "2026-09-20T00:00:00Z",
    }));
    expect(body.issues[1]).toEqual(expect.objectContaining({
      number: 2001,
      source: "github",
      reportStatus: "open",
    }));
    const issueQuery = db.preparedSql.find((sql) => sql.includes("FROM issues"));
    expect(issueQuery).toBeDefined();
    expect(issueQuery).toContain("repo IN (?,?)");
    expect(issueQuery).not.toContain("json_each(labels_json)");
    expect(issueQuery).not.toContain("LIMIT 500");
  });

  it("bounds the inbox with a stable cursor", async () => {
    const db = makeDb();
    const response = await onRequestGet({
      env: { DB: db },
      data: { orgId: 2, orgLogin: "No-Box-Dev", projectId: "playnist" },
      request: new Request("https://nox.test/api/v1/spots/project-overview?view=resolved&limit=1"),
    } as never);

    const body = await response.json() as { issues: Array<{ number: number }>; nextCursor: string | null };
    expect(body.issues).toHaveLength(1);
    expect(body.nextCursor).toBe("2026-09-20T00:00:00Z:2000");
    const issueQuery = db.preparedSql.find((sql) => sql.includes("FROM issues"));
    expect(issueQuery).toContain("state = ?");
    expect(issueQuery).toContain("ORDER BY updated_at DESC, id DESC LIMIT ?");
  });
});
