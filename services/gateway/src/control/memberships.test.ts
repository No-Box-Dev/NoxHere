import { describe, expect, it } from "vitest";
import type { AuthContext } from "./auth";
import { freshAdmin, handleMembershipControl, sensitiveAdminMutation } from "./memberships";

const admin: AuthContext = {
  credentialType: "session", credentialId: "session", principalId: "github:1", userLogin: "owner", userId: 1,
  orgId: 7, orgLogin: "acme", isAdmin: true, projectId: null, scopes: [], connectionId: "noxic_1",
  accessLevel: "member", guestAccess: null, role: "owner", capabilities: ["members.manage"], membershipVerifiedAt: new Date().toISOString(),
};

function dbWithTarget(target: { role: string; managed_role: string | null } | null) {
  const writes: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        sql,
        binds: [] as unknown[],
        bind(...binds: unknown[]) { statement.binds = binds; return statement; },
        async first() { return target; },
      };
      return statement;
    },
    async batch(statements: Array<{ binds: unknown[]; first?: () => unknown }>) {
      for (const statement of statements) writes.push({ sql: String((statement as unknown as { sql?: string }).sql ?? "write"), binds: statement.binds });
      return [];
    },
  } as unknown as D1Database;
  return { db, writes };
}

describe("organization member roles", () => {
  it("lets a freshly verified administrator assign a managed role", async () => {
    const { db, writes } = dbWithTarget({ role: "member", managed_role: null });
    const response = await handleMembershipControl(new Request("https://app.noxhere.com/api/v1/memberships/github%3A2", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "viewer" }),
    }), db, admin);
    expect(response?.status).toBe(200);
    expect(writes).toHaveLength(2);
  });

  it("protects GitHub organization owners from local demotion", async () => {
    const { db } = dbWithTarget({ role: "admin", managed_role: null });
    const response = await handleMembershipControl(new Request("https://app.noxhere.com/api/v1/memberships/github%3A2", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "member" }),
    }), db, admin);
    expect(response?.status).toBe(409);
  });

  it("requires recent provider verification for access changes", () => {
    expect(freshAdmin({ ...admin, membershipVerifiedAt: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(sensitiveAdminMutation(new Request("https://app.noxhere.com/api/v1/integrations/slack/routing", { method: "PATCH" }))).toBe(true);
    expect(sensitiveAdminMutation(new Request("https://app.noxhere.com/api/v1/features/12", { method: "PATCH" }))).toBe(false);
  });
});
