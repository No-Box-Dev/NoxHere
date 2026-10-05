import { z } from "zod";
import {
  createNativeSession,
  revokeNativeSession,
  rotateNativeSession,
} from "./auth";
import { apiError, boundedJson } from "./http";
import { persistIdentityClaims, validIdentityExchangeResult, type IdentityService } from "./oauth";

export const NATIVE_CLIENTS = ["noxconnect-cli", "noxfeed-mac"] as const;
const Client = z.enum(NATIVE_CLIENTS);
const Start = z.object({ client: Client }).strict();
const Poll = z.object({ client: Client, device_code: z.string().startsWith("noxid_").max(96) }).strict();
const Refresh = z.object({ refresh_token: z.string().startsWith("nox_rt_").max(256) }).strict();

export async function handleNativeAuth(
  request: Request,
  db: D1Database,
  identity: IdentityService,
): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/^\/api\/v1\/auth\/native/, "/api/auth/native");
  if (!path.startsWith("/api/auth/native/")) return null;
  if (request.method !== "POST") return apiError("method_not_allowed", "Method not allowed", 405);
  let body: unknown;
  try { body = path === "/api/auth/native/revoke" && request.body === null ? {} : await boundedJson(request); }
  catch { return apiError("invalid_request", "Request body must be valid bounded JSON", 400); }

  if (path === "/api/auth/native/device/start") {
    const parsed = Start.safeParse(body);
    if (!parsed.success) return apiError("invalid_request", "Invalid native client", 400);
    try {
      const result = await identity.startGitHubDeviceAuth(parsed.data);
      return json({
        device_code: result.deviceCode,
        user_code: result.userCode,
        verification_uri: result.verificationUri,
        expires_in: result.expiresIn,
        interval: result.interval,
      });
    } catch { return apiError("provider_unavailable", "GitHub sign-in is temporarily unavailable", 503); }
  }

  if (path === "/api/auth/native/device/poll") {
    const parsed = Poll.safeParse(body);
    if (!parsed.success) return apiError("invalid_request", "Invalid device authorization", 400);
    let result: Awaited<ReturnType<IdentityService["pollGitHubDeviceAuth"]>>;
    try {
      result = await identity.pollGitHubDeviceAuth({ client: parsed.data.client, deviceCode: parsed.data.device_code });
    } catch { return apiError("provider_unavailable", "GitHub sign-in is temporarily unavailable", 503); }
    if (result.status === "pending") return oauthError("authorization_pending", "Approve the code in GitHub", 202, result.retryAfter);
    if (result.status === "slow_down") return oauthError("slow_down", "Wait before checking again", 429, result.retryAfter);
    if (result.status === "expired") return oauthError("expired_token", "The sign-in code expired; start again", 400);
    if (result.status === "denied") return oauthError("access_denied", "GitHub authorization was denied", 400);
    if (result.status !== "complete") return apiError("invalid_identity_response", "Authentication service returned an invalid state", 502);
    if (!validIdentityExchangeResult(result)) return apiError("invalid_identity_response", "Authentication service returned an invalid identity", 502);
    const principalId = await persistIdentityClaims(db, result);
    const session = await createNativeSession(db, principalId, result.connectionId, parsed.data.client);
    return json({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      token_type: "bearer",
      expires_in: session.expiresIn,
      user: result.user,
      organizations: result.organizations,
    });
  }

  if (path === "/api/auth/native/refresh") {
    const parsed = Refresh.safeParse(body);
    if (!parsed.success) return oauthError("invalid_grant", "Invalid refresh credential", 401);
    const session = await rotateNativeSession(db, parsed.data.refresh_token);
    if (!session) return oauthError("invalid_grant", "The native session expired; sign in again", 401);
    return json({ access_token: session.accessToken, refresh_token: session.refreshToken, token_type: "bearer", expires_in: session.expiresIn });
  }

  if (path === "/api/auth/native/revoke") {
    const parsed = Refresh.partial().safeParse(body);
    if (!parsed.success) return apiError("invalid_request", "Invalid revoke request", 400);
    const revoked = await revokeNativeSession(db, request, parsed.data.refresh_token);
    return json({ revoked });
  }
  return apiError("not_found", "Native authentication endpoint not found", 404);
}

function json(body: unknown, status = 200, retryAfter?: number): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return Response.json(body, { status, headers });
}

function oauthError(error: string, errorDescription: string, status: number, retryAfter?: number): Response {
  return json({ error, error_description: errorDescription }, status, retryAfter);
}
