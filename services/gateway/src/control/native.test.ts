import { describe, expect, it, vi } from "vitest";
import { handleNativeAuth } from "./native";
import type { IdentityService } from "./oauth";

function database() {
  const executed: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        sql,
        binds: [] as unknown[],
        bind(...binds: unknown[]) { statement.binds = binds; return statement; },
        async run() { executed.push({ sql, binds: statement.binds }); return { meta: { changes: 1 } }; },
        async first() { return null; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; binds: unknown[] }>) {
      executed.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  } as unknown as D1Database;
  return { db, executed };
}

function identity(overrides: Partial<IdentityService> = {}): IdentityService {
  return {
    exchangeGitHubOAuth: vi.fn(),
    startGitHubDeviceAuth: vi.fn(async () => ({
      version: 1 as const, deviceCode: "noxid_attempt", userCode: "ABCD-EFGH",
      verificationUri: "https://github.com/login/device", expiresIn: 900, interval: 5,
    })),
    pollGitHubDeviceAuth: vi.fn(async () => ({ version: 1 as const, status: "pending" as const, retryAfter: 5 })),
    ...overrides,
  };
}

describe("NoxHere native authentication", () => {
  it("accepts the account-wide NoxConnect CLI client", async () => {
    const provider = identity();
    const response = await handleNativeAuth(new Request(
      "https://app.noxhere.com/api/v1/auth/native/device/start",
      { method: "POST", body: JSON.stringify({ client: "noxconnect-cli" }) },
    ), database().db, provider);
    expect(response?.status).toBe(200);
    expect(provider.startGitHubDeviceAuth).toHaveBeenCalledWith({ client: "noxconnect-cli" });
  });

  it("returns an opaque provider-device handle", async () => {
    const response = await handleNativeAuth(new Request(
      "https://app.noxhere.com/api/v1/auth/native/device/start",
      { method: "POST", body: JSON.stringify({ client: "noxfeed-mac" }) },
    ), database().db, identity());
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      device_code: "noxid_attempt",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
    });
  });

  it("creates only opaque NoxHere credentials after provider approval", async () => {
    const { db, executed } = database();
    const provider = identity({
      pollGitHubDeviceAuth: vi.fn(async () => ({
        version: 1 as const,
        status: "complete" as const,
        connectionId: "noxic_connection",
        user: { id: 42, login: "octocat", avatarUrl: null },
        organizations: [{ id: 7, login: "acme", role: "admin" as const }],
      })),
    });
    const response = await handleNativeAuth(new Request(
      "https://app.noxhere.com/api/v1/auth/native/device/poll",
      { method: "POST", body: JSON.stringify({ client: "noxfeed-mac", device_code: "noxid_attempt" }) },
    ), db, provider);
    expect(response?.status).toBe(200);
    const body = await response?.json() as { access_token: string; refresh_token: string };
    expect(body.access_token).toMatch(/^nox_at_/);
    expect(body.refresh_token).toMatch(/^nox_rt_/);
    const sessionInsert = executed.find((call) => call.sql.includes("INSERT INTO native_sessions"));
    expect(sessionInsert?.binds).toContain("noxic_connection");
    expect(sessionInsert?.binds).not.toContain(body.access_token);
    expect(sessionInsert?.binds).not.toContain(body.refresh_token);
    expect(String(sessionInsert?.binds[4])).toHaveLength(64);
    expect(String(sessionInsert?.binds[5])).toHaveLength(64);
  });

  it("preserves provider polling backoff", async () => {
    const response = await handleNativeAuth(new Request(
      "https://app.noxhere.com/api/auth/native/device/poll",
      { method: "POST", body: JSON.stringify({ client: "noxfeed-mac", device_code: "noxid_attempt" }) },
    ), database().db, identity());
    expect(response?.status).toBe(202);
    expect(response?.headers.get("Retry-After")).toBe("5");
    await expect(response?.json()).resolves.toMatchObject({ error: "authorization_pending" });
  });
});
