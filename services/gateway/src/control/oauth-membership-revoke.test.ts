import { describe, expect, it, vi } from "vitest";
import { persistIdentityClaims, refreshStoredGitHubMemberships, type IdentityExchangeResult } from "./oauth";

function database(existingPrincipal: string | null = "github:42") {
  const statements: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        sql,
        binds: [] as unknown[],
        bind(...binds: unknown[]) { statement.binds = binds; return statement; },
        async first() { return sql.includes("SELECT id FROM principals") && existingPrincipal ? { id: existingPrincipal } : null; },
      };
      statements.push(statement);
      return statement;
    },
    batch: vi.fn(async () => []),
  } as unknown as D1Database;
  return { db, statements };
}

const identity = (organizations: IdentityExchangeResult["organizations"]): IdentityExchangeResult => ({
  version: 1,
  connectionId: "noxic_connection",
  user: { id: 42, login: "alice", avatarUrl: null },
  organizations,
});

describe("GitHub membership revocation sync", () => {
  it("removes memberships absent from GitHub's current active organization list", async () => {
    const { db, statements } = database();
    await persistIdentityClaims(db, identity([
      { id: 7, login: "acme", role: "member" },
      { id: 9, login: "alice", role: "admin" },
    ]));

    const revoke = statements.find((statement) => statement.sql.includes("DELETE FROM org_memberships"));
    expect(revoke?.sql).toContain("org_id NOT IN (?,?)");
    expect(revoke?.binds).toEqual(["github:42", 7, 9]);
  });

  it("removes every stale membership when GitHub returns no active organizations", async () => {
    const { db, statements } = database();
    await persistIdentityClaims(db, identity([]));
    const revoke = statements.find((statement) => statement.sql.includes("DELETE FROM org_memberships"));
    expect(revoke?.sql).not.toContain("NOT IN");
    expect(revoke?.binds).toEqual(["github:42"]);
  });

  it("refreshes authoritative memberships through the private identity service", async () => {
    const { db } = database();
    const refreshGitHubIdentity = vi.fn(async () => identity([{ id: 7, login: "acme", role: "member" }]));
    await expect(refreshStoredGitHubMemberships(db, { refreshGitHubIdentity } as never, "github:42", "noxic_connection")).resolves.toBe(true);
    expect(refreshGitHubIdentity).toHaveBeenCalledWith({ connectionId: "noxic_connection" });
  });
});
