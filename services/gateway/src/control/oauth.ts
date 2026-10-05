import { constantTimeHashEqual } from "./crypto";
import { createBrowserSession, parseCookies, resolvePrincipalCredential, sessionCookies } from "./auth";
import { apiError } from "./http";
import { mergePrincipals } from "./guests";

export interface IdentityExchangeResult {
  version: 1;
  connectionId: string;
  user: { id: number; login: string; avatarUrl: string | null };
  organizations: Array<{ id: number; login: string; role: "member" | "admin" }>;
}

export interface IdentityService {
  exchangeGitHubOAuth(input: { code: string; redirectUri: string }): Promise<IdentityExchangeResult>;
  refreshGitHubIdentity?(input: { connectionId: string }): Promise<IdentityExchangeResult>;
  startGitHubDeviceAuth(input: { client: string }): Promise<{
    version: 1; deviceCode: string; userCode: string; verificationUri: string; expiresIn: number; interval: number;
  }>;
  pollGitHubDeviceAuth(input: { client: string; deviceCode: string }): Promise<
    | { version: 1; status: "pending" | "slow_down"; retryAfter: number }
    | { version: 1; status: "expired" | "denied" }
    | ({ version: 1; status: "complete" } & IdentityExchangeResult)
  >;
}

export interface EmailService {
  sendEmail(input: unknown): Promise<{
    contract: "noxconnect.transactional-email-receipt";
    version: 1;
    requestId: string;
    status: "accepted";
    provider: "postmark";
    messageId: string;
    submittedAt: string | null;
  }>;
}

export async function refreshStoredGitHubMemberships(
  db: D1Database,
  identity: IdentityService,
  principalId: string,
  connectionId: string,
): Promise<boolean> {
  if (!identity.refreshGitHubIdentity) return false;
  const result = await identity.refreshGitHubIdentity({ connectionId });
  if (!validIdentityExchangeResult(result)) throw new Error("invalid_identity_response");
  await persistIdentityClaims(db, result, principalId);
  return true;
}

const CALLBACK_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export async function handleOAuthCallback(
  request: Request,
  db: D1Database,
  identity: IdentityService,
): Promise<Response> {
  const url = new URL(request.url);
  const setupAction = url.searchParams.get("setup_action");
  if (setupAction === "install" || setupAction === "update") {
    return new Response(null, { status: 302, headers: { ...CALLBACK_HEADERS, Location: `${url.origin}/?install=ok` } });
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = parseCookies(request.headers.get("Cookie") ?? "").ut_oauth_state ?? "";
  if (!code) return apiError("missing_code", "Missing OAuth code", 400);
  if (!state || !stateCookie || !(await constantTimeHashEqual(state, stateCookie))) {
    return apiError("oauth_state_mismatch", "OAuth state mismatch", 403);
  }

  let result: IdentityExchangeResult;
  try {
    result = await identity.exchangeGitHubOAuth({
      code,
      redirectUri: `${url.origin}${url.pathname}`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "identity exchange failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return apiError("provider_unavailable", "Authentication service is temporarily unavailable", 502);
  }
  if (!validIdentityExchangeResult(result)) {
    return apiError("invalid_identity_response", "Authentication service returned an invalid identity", 502);
  }

  const current = await resolvePrincipalCredential(request, db);
  const principalId = await persistIdentityClaims(db, result, current?.row.principal_id);
  const session = await createBrowserSession(db, principalId, result.connectionId);
  const headers = new Headers({ ...CALLBACK_HEADERS, Location: `${url.origin}/?login=ok` });
  for (const cookie of sessionCookies(session.sessionToken, session.csrfToken)) headers.append("Set-Cookie", cookie);
  headers.append("Set-Cookie", "ut_oauth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  return new Response(null, { status: 302, headers });
}

export async function persistIdentityClaims(
  db: D1Database,
  result: IdentityExchangeResult,
  currentPrincipalId?: string,
): Promise<string> {
  const providerPrincipal = await db.prepare(
    "SELECT id FROM principals WHERE github_user_id = ? AND github_login NOT LIKE 'guest-%'",
  ).bind(result.user.id).first<{ id: string }>();
  let principalId = providerPrincipal?.id ?? currentPrincipalId ?? `github:${result.user.id}`;
  if (providerPrincipal && currentPrincipalId && providerPrincipal.id !== currentPrincipalId) {
    principalId = await mergePrincipals(db, currentPrincipalId, providerPrincipal.id);
  }

  const identityStatement = currentPrincipalId && !providerPrincipal
    ? db.prepare(
      `UPDATE principals
          SET github_user_id = ?, github_login = ?, avatar_url = ?, github_connection_id = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?`,
    ).bind(result.user.id, result.user.login, result.user.avatarUrl, result.connectionId, principalId)
    : db.prepare(
      `INSERT INTO principals (id, github_user_id, github_login, avatar_url, github_connection_id, updated_at)
       VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(github_user_id) DO UPDATE SET
         github_login = excluded.github_login,
         avatar_url = excluded.avatar_url,
         github_connection_id = excluded.github_connection_id,
         updated_at = excluded.updated_at`,
    ).bind(principalId, result.user.id, result.user.login, result.user.avatarUrl, result.connectionId);
  const statements: D1PreparedStatement[] = [identityStatement];
  const activeOrganizations = [...new Map(result.organizations.map((org) => [org.id, org])).values()];
  for (const org of activeOrganizations) {
    if (!Number.isSafeInteger(org.id) || !org.login || !["member", "admin"].includes(org.role)) continue;
    statements.push(
      db.prepare(
        `INSERT INTO orgs (id, github_login) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET github_login = excluded.github_login`,
      ).bind(org.id, org.login),
      db.prepare(
        `INSERT INTO org_memberships (org_id, principal_id, role, verified_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(org_id, principal_id) DO UPDATE SET
           role = excluded.role, verified_at = excluded.verified_at`,
      ).bind(org.id, principalId, org.role),
    );
  }
  // GitHub's active membership response is authoritative. This runs after
  // the upserts in the same D1 batch, so a role change is retained while an
  // organization the user has left is removed. Explicit guest grants live in
  // a separate table and intentionally survive as the lower access tier.
  if (activeOrganizations.length) {
    statements.push(db.prepare(
      `DELETE FROM org_memberships
        WHERE principal_id = ?
          AND org_id NOT IN (${activeOrganizations.map(() => "?").join(",")})`,
    ).bind(principalId, ...activeOrganizations.map((org) => org.id)));
  } else {
    statements.push(db.prepare("DELETE FROM org_memberships WHERE principal_id = ?").bind(principalId));
  }
  await db.batch(statements);
  return principalId;
}

export function validIdentityExchangeResult(value: unknown): value is IdentityExchangeResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<IdentityExchangeResult>;
  return result.version === 1
    && typeof result.connectionId === "string" && result.connectionId.startsWith("noxic_")
    && Boolean(result.user && Number.isSafeInteger(result.user.id) && typeof result.user.login === "string" && result.user.login)
    && Array.isArray(result.organizations)
    && result.organizations.every((org) => Number.isSafeInteger(org.id)
      && typeof org.login === "string" && Boolean(org.login)
      && (org.role === "member" || org.role === "admin"));
}
