import { describe, expect, it, vi } from "vitest";
import { createNativeAuth, type NativeSessionState } from "./auth.js";

const expired: NativeSessionState = {
  accessToken: "nox_at_old",
  refreshToken: "nox_rt_old",
  accessExpiresAt: "2020-01-01T00:00:00.000Z",
};

describe("NoxHere native authentication", () => {
  it("starts and polls device authorization without storing pending state", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({
        device_code: "device-1", user_code: "ABCD", verification_uri: "https://app.noxhere.com/device",
      }))
      .mockResolvedValueOnce(Response.json({ status: "pending" }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ access_token: "nox_at_new", refresh_token: "nox_rt_new", expires_in: 900 }));
    const saved: NativeSessionState[] = [];
    const auth = createNativeAuth({
      client: "test-client",
      fetch: request as typeof fetch,
      storage: { load: () => saved.at(-1) ?? null, save: (session) => { saved.push(session); }, clear: () => { saved.length = 0; } },
    });
    await expect(auth.start()).resolves.toMatchObject({ deviceCode: "device-1", userCode: "ABCD" });
    await expect(auth.poll("device-1")).resolves.toBeNull();
    expect(saved).toHaveLength(0);
    await expect(auth.poll("device-1")).resolves.toMatchObject({ accessToken: "nox_at_new", refreshToken: "nox_rt_new" });
    expect(saved).toHaveLength(1);
  });

  it("rotates an expired credential once across concurrent callers", async () => {
    const request = vi.fn(async () => Response.json({ access_token: "nox_at_rotated", refresh_token: "nox_rt_rotated", expires_in: 900 }));
    const auth = createNativeAuth({ client: "test-client", session: expired, fetch: request as typeof fetch });
    await expect(Promise.all([auth.accessToken(), auth.accessToken(), auth.accessToken()]))
      .resolves.toEqual(["nox_at_rotated", "nox_at_rotated", "nox_at_rotated"]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((request.mock.calls[0][1] as RequestInit).body))).toEqual({ refresh_token: "nox_rt_old" });
  });

  it("revokes and clears only through caller-provided storage", async () => {
    let state: NativeSessionState | null = expired;
    const request = vi.fn(async () => Response.json({ revoked: true }));
    const auth = createNativeAuth({
      client: "test-client", fetch: request as typeof fetch,
      storage: { load: () => state, save: (next) => { state = next; }, clear: () => { state = null; } },
    });
    await auth.revoke();
    expect(state).toBeNull();
    expect(String(request.mock.calls[0][0])).toContain("/api/v1/auth/native/revoke");
  });
});
