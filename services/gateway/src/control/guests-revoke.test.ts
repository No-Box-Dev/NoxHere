import { describe, expect, it, vi } from "vitest";
import { handleGuestControl, type GuestEnv } from "./guests";
import type { AuthContext } from "./auth";

const env: GuestEnv = {
  email: { sendEmail: vi.fn(async (input: unknown) => ({
    contract: "noxconnect.transactional-email-receipt" as const,
    version: 1 as const,
    requestId: String((input as { requestId: string }).requestId),
    status: "accepted" as const,
    provider: "postmark" as const,
    messageId: "message-id",
    submittedAt: null,
  })) },
  PUBLIC_APP_ORIGIN: "https://app.noxhere.com",
};
const admin: AuthContext = {
  credentialType: "session", credentialId: "session", principalId: "github:1",
  userLogin: "admin", userId: 1, orgId: 7, orgLogin: "acme", isAdmin: true,
  projectId: null, scopes: [], connectionId: "noxic_one", accessLevel: "member", guestAccess: null,
};

function database() {
  const writes: Array<{ sql: string; binds: unknown[] }> = [];
  const db = { prepare(sql: string) { const statement = {
    binds: [] as unknown[], bind(...binds: unknown[]) { statement.binds = binds; return statement; },
    async run() { writes.push({ sql, binds: statement.binds }); return { success: true, meta: { changes: 1 } }; },
  }; return statement; } } as unknown as D1Database;
  return { db, writes };
}

describe("guest revocation", () => {
  it("revokes a pending invitation only inside the administrator's organization", async () => {
    const { db, writes } = database();
    const response = await handleGuestControl(new Request("https://app.noxhere.com/api/v1/guests/invites/invite-1", { method: "DELETE" }), db, env, admin);
    expect(response?.status).toBe(200);
    expect(writes[0].sql).toContain("accepted_at IS NULL");
    expect(writes[0].binds).toEqual(["invite-1", 7]);
  });

  it("revokes an active grant so subsequent authorization no longer loads it", async () => {
    const { db, writes } = database();
    const response = await handleGuestControl(new Request("https://app.noxhere.com/api/v1/guests/grants/grant-1", { method: "DELETE" }), db, env, admin);
    expect(response?.status).toBe(200);
    expect(writes[0].sql).toContain("SET revoked_at");
    expect(writes[0].binds).toEqual(["grant-1", 7]);
  });

  it("does not allow a non-admin to revoke invitations or grants", async () => {
    const { db, writes } = database();
    const response = await handleGuestControl(new Request("https://app.noxhere.com/api/v1/guests/grants/grant-1", { method: "DELETE" }), db, env, { ...admin, isAdmin: false });
    expect(response?.status).toBe(403);
    expect(writes).toHaveLength(0);
  });
});
