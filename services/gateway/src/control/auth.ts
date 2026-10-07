import { apiError } from "./http";
import { constantTimeHashEqual, randomToken, sha256 } from "./crypto";
import { guestCanAccess, loadGuestAccess, type GuestAccess } from "./guest-access";

export const SESSION_COOKIE = "__Host-nox_session";
export const CSRF_COOKIE = "nox_csrf";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const NATIVE_ACCESS_MAX_AGE_SECONDS = 15 * 60;
export const NATIVE_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const API_TOKEN_SCOPES = [
  "services:read",
  "developer-feedback:write",
  "noxfeed:read", "noxfeed:write",
  "noxspot:read", "noxspot:write",
  "noxcue:read", "noxcue:write",
] as const;

type CredentialType = "session" | "native_session" | "api_token";

export interface AuthContext {
  credentialType: CredentialType;
  credentialId: string;
  principalId: string | null;
  userLogin: string;
  userId: number | null;
  orgId: number;
  orgLogin: string;
  isAdmin: boolean;
  projectId: string | null;
  scopes: string[];
  connectionId: string | null;
  accessLevel: "member" | "guest" | "api_token";
  guestAccess: GuestAccess | null;
}

export interface PrincipalCredentialRow {
  credential_id: string;
  principal_id: string;
  github_user_id: number;
  github_login: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  connection_id: string | null;
  csrf_hash?: string;
}

interface MembershipRow {
  org_id: number;
  github_login: string;
  role: "member" | "admin";
  suspended_at: string | null;
}

interface ApiTokenRow {
  id: string;
  org_id: number;
  project_id: string;
  scopes_json: string;
  org_login: string;
  project_enabled: number;
}

export type AuthResult =
  | { context: AuthContext; session?: PrincipalCredentialRow }
  | { response: Response };

export async function resolvePrincipalCredential(
  request: Request,
  db: D1Database,
): Promise<{ credentialType: "session" | "native_session"; row: PrincipalCredentialRow } | null> {
  const bearerHeader = request.headers.get("Authorization") ?? "";
  const bearer = bearerHeader.startsWith("Bearer ") ? bearerHeader.slice(7).trim() : "";
  if (bearer.startsWith("nox_at_")) {
    const row = await db.prepare(
      `SELECT native.id AS credential_id, native.principal_id,
              principal.github_user_id,
              CASE WHEN principal.email IS NOT NULL AND principal.github_login LIKE 'guest-%'
                   THEN principal.email ELSE principal.github_login END AS github_login,
              principal.email, principal.display_name, principal.avatar_url,
              COALESCE(native.connection_id, principal.github_connection_id) AS connection_id
         FROM native_sessions native
         JOIN principals principal ON principal.id = native.principal_id
        WHERE native.access_token_hash = ? AND native.revoked_at IS NULL
          AND native.access_expires_at > ? AND native.refresh_expires_at > ?`,
    ).bind(await sha256(bearer), new Date().toISOString(), new Date().toISOString())
      .first<PrincipalCredentialRow>();
    return row ? { credentialType: "native_session", row } : null;
  }
  if (bearer) return null;
  const cookie = parseCookies(request.headers.get("Cookie") ?? "")[SESSION_COOKIE];
  if (!cookie) return null;
  const row = await db.prepare(
    `SELECT session.token_hash AS credential_id, session.principal_id,
            principal.github_user_id,
            CASE WHEN principal.email IS NOT NULL AND principal.github_login LIKE 'guest-%'
                 THEN principal.email ELSE principal.github_login END AS github_login,
            principal.email, principal.display_name, principal.avatar_url,
            COALESCE(session.connection_id, principal.github_connection_id) AS connection_id,
            session.csrf_hash
       FROM browser_sessions session
       JOIN principals principal ON principal.id = session.principal_id
      WHERE session.token_hash = ? AND session.revoked_at IS NULL
        AND session.expires_at > ?`,
  ).bind(await sha256(cookie), new Date().toISOString()).first<PrincipalCredentialRow>();
  return row ? { credentialType: "session", row } : null;
}

export function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

export function sessionCookies(sessionToken: string, csrfToken: string): string[] {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
}

export function clearSessionCookies(): string[] {
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
    `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Secure; Max-Age=0`,
  ];
}

export async function createBrowserSession(
  db: D1Database,
  principalId: string,
  connectionId: string | null,
): Promise<{ sessionToken: string; csrfToken: string; expiresAt: string }> {
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const [tokenHash, csrfHash] = await Promise.all([sha256(sessionToken), sha256(csrfToken)]);
  await db.prepare(
    `INSERT INTO browser_sessions
       (token_hash, principal_id, connection_id, csrf_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(tokenHash, principalId, connectionId, csrfHash, expiresAt).run();
  return { sessionToken, csrfToken, expiresAt };
}

export async function createNativeSession(
  db: D1Database,
  principalId: string,
  connectionId: string,
  clientName: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const id = `noxns_${crypto.randomUUID().replaceAll("-", "")}`;
  const accessToken = `nox_at_${randomToken()}`;
  const refreshToken = `nox_rt_${randomToken()}`;
  await db.prepare(
    `INSERT INTO native_sessions
       (id, principal_id, connection_id, client_name, access_token_hash,
        refresh_token_hash, access_expires_at, refresh_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, principalId, connectionId, clientName,
    await sha256(accessToken), await sha256(refreshToken),
    new Date(Date.now() + NATIVE_ACCESS_MAX_AGE_SECONDS * 1000).toISOString(),
    new Date(Date.now() + NATIVE_REFRESH_MAX_AGE_SECONDS * 1000).toISOString(),
  ).run();
  return { accessToken, refreshToken, expiresIn: NATIVE_ACCESS_MAX_AGE_SECONDS };
}

export async function rotateNativeSession(
  db: D1Database,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const row = await db.prepare(
    `SELECT id, refresh_expires_at FROM native_sessions
      WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_expires_at > ?`,
  ).bind(await sha256(refreshToken), new Date().toISOString()).first<{ id: string; refresh_expires_at: string }>();
  if (!row) return null;
  const accessToken = `nox_at_${randomToken()}`;
  const nextRefreshToken = `nox_rt_${randomToken()}`;
  const updated = await db.prepare(
    `UPDATE native_sessions SET access_token_hash = ?, refresh_token_hash = ?,
        access_expires_at = ?, refresh_expires_at = ?,
        rotated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL RETURNING id`,
  ).bind(
    await sha256(accessToken), await sha256(nextRefreshToken),
    new Date(Date.now() + NATIVE_ACCESS_MAX_AGE_SECONDS * 1000).toISOString(),
    row.refresh_expires_at,
    row.id, await sha256(refreshToken),
  ).first();
  return updated ? { accessToken, refreshToken: nextRefreshToken, expiresIn: NATIVE_ACCESS_MAX_AGE_SECONDS } : null;
}

export async function revokeNativeSession(db: D1Database, request: Request, refreshToken?: string): Promise<boolean> {
  const bearer = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const hash = refreshToken?.startsWith("nox_rt_")
    ? await sha256(refreshToken)
    : bearer.startsWith("nox_at_") ? await sha256(bearer) : null;
  if (!hash) return false;
  const column = refreshToken ? "refresh_token_hash" : "access_token_hash";
  const result = await db.prepare(
    `UPDATE native_sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE ${column} = ? AND revoked_at IS NULL`,
  ).bind(hash).run();
  return Boolean(result.meta.changes);
}

export async function authenticate(request: Request, db: D1Database): Promise<AuthResult> {
  const url = new URL(request.url);
  const bearerHeader = request.headers.get("Authorization") ?? "";
  const bearer = bearerHeader.startsWith("Bearer ") ? bearerHeader.slice(7).trim() : "";
  const presentedOrg = request.headers.get("X-Org") ?? url.searchParams.get("org");

  if (bearer.startsWith("nox_sk_")) return authenticateApiToken(request, db, bearer, presentedOrg);

  if (bearer && !bearer.startsWith("nox_at_")) {
    return { response: apiError("unsupported_credential", "Use a NoxHere session or project-scoped API token", 401) };
  }
  const principal = await resolvePrincipalCredential(request, db);
  if (!principal) return { response: apiError("unauthorized", "Session expired; sign in again", 401) };
  const { credentialType, row } = principal;
  if (credentialType === "session" && !(await validateCsrf(request, row.csrf_hash ?? ""))) {
    return { response: apiError("csrf_failed", "CSRF validation failed", 403) };
  }
  if (!presentedOrg) return { response: apiError("missing_organization", "Missing X-Org header or org query parameter", 400) };

  const membership = await db.prepare(
    `SELECT org.id AS org_id, org.github_login, membership.role, org.suspended_at
       FROM org_memberships membership
       JOIN orgs org ON org.id = membership.org_id
      WHERE membership.principal_id = ? AND org.github_login = ? COLLATE NOCASE`,
  ).bind(row.principal_id, presentedOrg).first<MembershipRow>();
  if (membership?.suspended_at) return { response: apiError("organization_suspended", "This organization has been suspended. Contact support.", 403) };

  if (!membership) {
    const org = await db.prepare(
      "SELECT id AS org_id, github_login, suspended_at FROM orgs WHERE github_login = ? COLLATE NOCASE",
    ).bind(presentedOrg).first<{ org_id: number; github_login: string; suspended_at: string | null }>();
    if (!org) return { response: apiError("organization_forbidden", "This organization is unavailable", 403) };
    if (org.suspended_at) return { response: apiError("organization_suspended", "This organization has been suspended. Contact support.", 403) };
    const guest = await loadGuestAccess(db, row.principal_id, org.org_id);
    if (!guest) return { response: apiError("organization_forbidden", "Not a member or guest of this organization", 403) };
    const guestError = validateGuestRequest(request, guest.access);
    if (guestError) return { response: guestError };
    const projectId = requestProjectId(request);
    const service = serviceForPath(url.pathname);
    return {
      context: {
        credentialType,
        credentialId: row.credential_id,
        principalId: row.principal_id,
        userLogin: row.github_login,
        userId: row.github_user_id,
        orgId: org.org_id,
        orgLogin: org.github_login,
        isAdmin: false,
        projectId,
        scopes: service ? [`${service}:read`] : ["guest:read"],
        // A linked provider is usable only after its verified GitHub claims
        // establish real organization membership.
        connectionId: null,
        accessLevel: "guest",
        guestAccess: guest.access,
      },
      session: row,
    };
  }

  return {
    context: {
      credentialType,
      credentialId: row.credential_id,
      principalId: row.principal_id,
      userLogin: row.github_login,
      userId: row.github_user_id,
      orgId: membership.org_id,
      orgLogin: membership.github_login,
      isAdmin: membership.role === "admin",
      projectId: requestProjectId(request),
      scopes: [],
      connectionId: row.connection_id,
      accessLevel: "member",
      guestAccess: null,
    },
    session: row,
  };
}

async function authenticateApiToken(
  request: Request,
  db: D1Database,
  bearer: string,
  presentedOrg: string | null,
): Promise<AuthResult> {
  const row = await db.prepare(
    `SELECT token.id, token.org_id, token.project_id, token.scopes_json,
            org.github_login AS org_login,
            CASE WHEN project.enabled = 1 AND project.archived = 0 THEN 1 ELSE 0 END AS project_enabled
       FROM api_tokens token
       JOIN orgs org ON org.id = token.org_id
       JOIN projects project ON project.id = token.project_id AND project.org_id = token.org_id
      WHERE token.token_hash = ? AND token.revoked_at IS NULL
        AND (token.expires_at IS NULL OR token.expires_at > ?)`,
  ).bind(await sha256(bearer), new Date().toISOString()).first<ApiTokenRow>();
  if (!row) return { response: apiError("unauthorized", "Invalid or expired API token", 401) };
  if (row.project_enabled !== 1) return { response: apiError("project_not_enabled", "This token's project is no longer enabled", 403) };
  if (presentedOrg && presentedOrg.toLowerCase() !== row.org_login.toLowerCase()) {
    return { response: apiError("organization_forbidden", "API token belongs to a different organization", 403) };
  }
  const presentedProject = request.headers.get("X-Project-ID")
    ?? new URL(request.url).searchParams.get("projectId")
    ?? new URL(request.url).searchParams.get("project");
  if (presentedProject && presentedProject !== row.project_id) {
    return { response: apiError("resource_not_found", "The requested resource was not found", 404) };
  }
  let scopes: string[];
  try {
    const parsed = JSON.parse(row.scopes_json) as unknown;
    if (!Array.isArray(parsed) || parsed.some((scope) => typeof scope !== "string")) throw new Error();
    scopes = parsed;
  } catch {
    return { response: apiError("unauthorized", "Invalid API token scope data", 401) };
  }
  const required = requiredScope(new URL(request.url).pathname, request.method);
  if (!required) return { response: apiError("api_token_not_supported", "This endpoint does not accept automation tokens", 403) };
  const writeEquivalent = required.endsWith(":read") ? required.replace(/:read$/, ":write") : null;
  if (!scopes.includes(required) && !(writeEquivalent && scopes.includes(writeEquivalent))) {
    return { response: apiError("insufficient_scope", `This operation requires ${required}`, 403, { requiredScope: required }) };
  }
  return {
    context: {
      credentialType: "api_token",
      credentialId: row.id,
      principalId: null,
      userLogin: `api-token:${row.id}`,
      userId: null,
      orgId: row.org_id,
      orgLogin: row.org_login,
      isAdmin: required.endsWith(":write"),
      projectId: row.project_id,
      scopes,
      connectionId: null,
      accessLevel: "api_token",
      guestAccess: null,
    },
  };
}

async function validateCsrf(request: Request, expectedHash: string): Promise<boolean> {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const header = request.headers.get("X-CSRF-Token") ?? "";
  const cookie = cookies[CSRF_COOKIE] ?? "";
  if (!header || !cookie || !(await constantTimeHashEqual(header, cookie))) return false;
  return constantTimeHashEqual(await sha256(header), expectedHash);
}

export async function revokeBrowserSession(request: Request, db: D1Database): Promise<Response> {
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const row = await db.prepare(
      `SELECT csrf_hash FROM browser_sessions
        WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(await sha256(token), new Date().toISOString()).first<{ csrf_hash: string }>();
    if (row && !(await validateCsrf(request, row.csrf_hash))) {
      return apiError("csrf_failed", "CSRF validation failed", 403);
    }
    await db.prepare(
      `UPDATE browser_sessions
          SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE token_hash = ? AND revoked_at IS NULL`,
    ).bind(await sha256(token)).run();
  }
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  for (const cookie of clearSessionCookies()) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ loggedOut: true }), { headers });
}

export function requiredScope(pathname: string, method: string): string | null {
  const access = ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) ? "read" : "write";
  if (pathname === "/api/v1/developer-feedback" && access === "write") return "developer-feedback:write";
  const service = pathname.match(/^\/api\/v1\/services\/([^/]+)/)?.[1];
  if (service && service !== "noxconnect") return `${service}:${access}`;
  if (pathname === "/api/v1/services" && access === "read") return "services:read";
  if (pathname === "/api/v1/feed" || /^\/api\/v1\/(issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|noxfeed)(?:\/|$)/.test(pathname)) return `noxfeed:${access}`;
  if (/^\/api\/v1\/spots(?:\/|$)/.test(pathname)) return `noxspot:${access}`;
  if (/^\/api\/v1\/cues(?:\/|$)/.test(pathname)) return `noxcue:${access}`;
  return null;
}

export function serviceForPath(pathname: string): string | null {
  const serviceControl = pathname.match(/^\/api\/v1\/services\/(noxticket|noxfeed|noxspot|noxcue)(?:\/|$)/)?.[1];
  if (serviceControl) return serviceControl;
  if (/^\/api\/(?:v1\/)?(features|specs|assign|issue-state)(?:\/|$)/.test(pathname)) return "noxticket";
  if (pathname === "/api/v1/feed" || /^\/api\/(?:v1\/)?(issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|noxfeed)(?:\/|$)/.test(pathname)) return "noxfeed";
  if (/^\/api\/(?:v1\/)?spots(?:\/|$)/.test(pathname)) return "noxspot";
  if (/^\/api\/(?:v1\/)?cues(?:\/|$)/.test(pathname)) return "noxcue";
  return null;
}

export function requestProjectId(request: Request): string | null {
  const url = new URL(request.url);
  const header = request.headers.get("X-Project-ID")?.trim();
  const query = url.searchParams.get("project_id")?.trim();
  const path = url.pathname.match(/^\/api\/(?:v1\/)?projects\/([^/]+)(?:\/|$)/)?.[1]
    ?? url.pathname.match(/^\/api\/(?:v1\/)?cues\/projects\/([^/]+)(?:\/|$)/)?.[1];
  return header || query || (path ? decodeURIComponent(path) : null);
}

export function validateGuestRequest(request: Request, access: GuestAccess): Response | null {
  const url = new URL(request.url);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return apiError("guest_read_only", "Guest access is read-only", 403);
  }
  if (url.pathname === "/api/projects" || url.pathname === "/api/v1/projects"
      || url.pathname === "/api/me" || url.pathname === "/api/v1/me"
      || url.pathname === "/api/v1/services") return null;
  const service = serviceForPath(url.pathname);
  if (!service) return apiError("guest_scope_forbidden", "This operation is not available to guests", 403);
  const projectId = requestProjectId(request);
  if (!projectId) {
    return access.organizationWide
      ? null
      : apiError("project_required", "Select a granted project with X-Project-ID", 400);
  }
  if (!guestCanAccess(access, projectId, service)) {
    return apiError("resource_not_found", "The requested resource was not found", 404);
  }
  return null;
}

export async function createApiTokenValue(environment: "live" | "test") {
  const id = `noxkey_${crypto.randomUUID().replaceAll("-", "")}`;
  const token = `nox_sk_${environment}_${id.slice(-12)}_${randomToken()}`;
  return { id, token, prefix: token.slice(0, 24) };
}
