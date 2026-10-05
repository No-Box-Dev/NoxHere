import type { AuthContext } from "./auth";
import {
  createBrowserSession,
  resolvePrincipalCredential,
  sessionCookies,
} from "./auth";
import { randomToken, sha256 } from "./crypto";
import { isGuestService, type GuestScopeType } from "./guest-access";
import { apiError, apiResponse, boundedJson } from "./http";

const INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_MAX_AGE_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface GuestEnv {
  email: TransactionalEmailService;
  PUBLIC_APP_ORIGIN: string;
}

export interface TransactionalEmailService {
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

interface InviteInput {
  email?: unknown;
  scopeType?: unknown;
  projectId?: unknown;
  service?: unknown;
}

interface InviteRow {
  id: string;
  org_id: number;
  org_login: string;
  email: string;
  scope_type: GuestScopeType;
  project_id: string | null;
  project_name: string | null;
  service: string | null;
  expires_at: string;
}

interface LoginTokenRow {
  principal_id: string;
  connection_id?: string | null;
}

export async function handleGuestControl(
  request: Request,
  db: D1Database,
  env: GuestEnv,
  auth: AuthContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/guests" && request.method === "GET") {
    if (!auth.isAdmin) return apiError("admin_required", "Organization admin access is required", 403);
    return listGuestAccess(db, auth.orgId);
  }
  if (url.pathname === "/api/v1/guests/invites" && request.method === "POST") {
    if (!auth.isAdmin) return apiError("admin_required", "Organization admin access is required", 403);
    return createInvite(request, db, env, auth);
  }
  const inviteId = url.pathname.match(/^\/api\/v1\/guests\/invites\/([^/]+)$/)?.[1];
  if (inviteId && request.method === "DELETE") {
    if (!auth.isAdmin) return apiError("admin_required", "Organization admin access is required", 403);
    await db.prepare(
      `UPDATE guest_invitations
          SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND org_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
    ).bind(decodeURIComponent(inviteId), auth.orgId).run();
    return apiResponse({ revoked: true });
  }
  const grantId = url.pathname.match(/^\/api\/v1\/guests\/grants\/([^/]+)$/)?.[1];
  if (grantId && request.method === "DELETE") {
    if (!auth.isAdmin) return apiError("admin_required", "Organization admin access is required", 403);
    await db.prepare(
      `UPDATE guest_access_grants
          SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND org_id = ? AND revoked_at IS NULL`,
    ).bind(decodeURIComponent(grantId), auth.orgId).run();
    return apiResponse({ revoked: true });
  }
  return null;
}

export async function requestEmailLogin(
  request: Request,
  db: D1Database,
  env: GuestEnv,
): Promise<Response> {
  let body: { email?: unknown };
  try { body = await boundedJson(request, 8 * 1024); }
  catch { return apiError("invalid_request", "Enter a valid email address", 400); }
  const email = normalizeEmail(body.email);
  if (!email) return apiError("invalid_email", "Enter a valid email address", 400);

  const identity = await db.prepare(
    `SELECT email.principal_id
       FROM principal_emails email
      WHERE email.email = ? COLLATE NOCASE`,
  ).bind(email).first<{ principal_id: string }>();
  if (identity) {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recent = await db.prepare(
      `SELECT COUNT(*) AS count FROM email_login_tokens
        WHERE principal_id = ? AND created_at > ?`,
    ).bind(identity.principal_id, cutoff).first<{ count: number }>();
    if ((recent?.count ?? 0) === 0) {
      const token = randomToken();
      await db.prepare(
        `INSERT INTO email_login_tokens (token_hash, principal_id, expires_at)
         VALUES (?, ?, ?)`,
      ).bind(await sha256(token), identity.principal_id, new Date(Date.now() + LOGIN_MAX_AGE_MS).toISOString()).run();
      try {
        await sendEmail(env, `email-login:${await sha256(token)}`, email, "Your Nox sign-in link", "Sign in to Nox", callbackUrl(env, token, "login"),
          "This link expires in 15 minutes and can be used once.");
      } catch (error) {
        console.error(JSON.stringify({ event: "guest_email_failed", kind: "login", error: errorMessage(error) }));
      }
    }
  }
  return apiResponse({ accepted: true }, 202);
}

export async function consumeEmailCallback(
  request: Request,
  db: D1Database,
  env: GuestEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const kind = url.searchParams.get("kind");
  if (!token || token.length > 256 || (kind !== "invite" && kind !== "login")) {
    return callbackRedirect(env, "invalid");
  }
  return kind === "invite"
    ? consumeInvite(request, db, env, token)
    : consumeLogin(request, db, env, token);
}

async function createInvite(
  request: Request,
  db: D1Database,
  env: GuestEnv,
  auth: AuthContext,
): Promise<Response> {
  let body: InviteInput;
  try { body = await boundedJson(request, 16 * 1024); }
  catch { return apiError("invalid_request", "Invalid invitation request", 400); }
  const email = normalizeEmail(body.email);
  const scopeType = body.scopeType;
  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
  const service = isGuestService(body.service) ? body.service : null;
  if (!email) return apiError("invalid_email", "Enter a valid email address", 400);
  if (!validScope(scopeType, projectId, service)) {
    return apiError("invalid_scope", "Choose an organization, project, or project tool scope", 400);
  }

  let projectName: string | null = null;
  if (projectId) {
    const project = await db.prepare(
      `SELECT name FROM projects
        WHERE id = ? AND org_id = ? AND archived = 0 AND enabled = 1`,
    ).bind(projectId, auth.orgId).first<{ name: string }>();
    if (!project) return apiError("project_not_found", "The project is unavailable", 404);
    projectName = project.name;
  }

  const token = randomToken();
  const id = `noxinvite_${crypto.randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(Date.now() + INVITE_MAX_AGE_MS).toISOString();
  await db.batch([
    db.prepare(
      `UPDATE guest_invitations
          SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE org_id = ? AND email = ? COLLATE NOCASE AND scope_type = ?
          AND COALESCE(project_id, '') = COALESCE(?, '')
          AND COALESCE(service, '') = COALESCE(?, '')
          AND accepted_at IS NULL AND revoked_at IS NULL`,
    ).bind(auth.orgId, email, scopeType, projectId, service),
    db.prepare(
      `INSERT INTO guest_invitations
         (id, org_id, email, scope_type, project_id, service, token_hash, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, auth.orgId, email, scopeType, projectId, service, await sha256(token), auth.userLogin, expiresAt),
  ]);

  const scopeLabel = invitationScopeLabel(scopeType, projectName, service);
  try {
    await sendEmail(
      env,
      `guest-invitation:${id}`,
      email,
      `You are invited to ${auth.orgLogin} on Nox`,
      `Join ${auth.orgLogin} on Nox`,
      callbackUrl(env, token, "invite"),
      `You will receive read-only access to ${scopeLabel}. This invitation expires in 7 days.`,
    );
  } catch (error) {
    await db.prepare(
      "UPDATE guest_invitations SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    ).bind(id).run();
    console.error(JSON.stringify({ event: "guest_email_failed", kind: "invite", inviteId: id, error: errorMessage(error) }));
    return apiError("email_unavailable", "The invitation could not be delivered", 502);
  }

  return apiResponse({ invitation: { id, email, scopeType, projectId, service, expiresAt } }, 201);
}

async function listGuestAccess(db: D1Database, orgId: number): Promise<Response> {
  const [grants, invitations] = await Promise.all([
    db.prepare(
      `SELECT grant.id, email.email, grant.scope_type AS scopeType,
              grant.project_id AS projectId, project.name AS projectName,
              grant.service, grant.created_at AS createdAt
         FROM guest_access_grants grant
         JOIN principal_emails email ON email.principal_id = grant.principal_id
         LEFT JOIN projects project ON project.id = grant.project_id AND project.org_id = grant.org_id
        WHERE grant.org_id = ? AND grant.revoked_at IS NULL
        ORDER BY lower(email.email), grant.created_at`,
    ).bind(orgId).all(),
    db.prepare(
      `SELECT invite.id, invite.email, invite.scope_type AS scopeType,
              invite.project_id AS projectId, project.name AS projectName,
              invite.service, invite.expires_at AS expiresAt, invite.created_at AS createdAt
         FROM guest_invitations invite
         LEFT JOIN projects project ON project.id = invite.project_id AND project.org_id = invite.org_id
        WHERE invite.org_id = ? AND invite.accepted_at IS NULL AND invite.revoked_at IS NULL
          AND invite.expires_at > ?
        ORDER BY invite.created_at DESC`,
    ).bind(orgId, new Date().toISOString()).all(),
  ]);
  return apiResponse({ grants: grants.results, invitations: invitations.results });
}

async function consumeInvite(request: Request, db: D1Database, env: GuestEnv, token: string): Promise<Response> {
  const tokenHash = await sha256(token);
  const invite = await db.prepare(
    `SELECT invite.id, invite.org_id, org.github_login AS org_login, invite.email,
            invite.scope_type, invite.project_id, project.name AS project_name,
            invite.service, invite.expires_at
       FROM guest_invitations invite
       JOIN orgs org ON org.id = invite.org_id
       LEFT JOIN projects project ON project.id = invite.project_id AND project.org_id = invite.org_id
      WHERE invite.token_hash = ? AND invite.accepted_at IS NULL AND invite.revoked_at IS NULL
        AND invite.expires_at > ?`,
  ).bind(tokenHash, new Date().toISOString()).first<InviteRow>();
  if (!invite) return callbackRedirect(env, "expired");
  const claimed = await db.prepare(
    `UPDATE guest_invitations
        SET accepted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`,
  ).bind(invite.id).first<{ id: string }>();
  if (!claimed) return callbackRedirect(env, "expired");

  const current = await resolvePrincipalCredential(request, db);
  const mapped = await db.prepare(
    `SELECT email.principal_id, principal.github_connection_id AS connection_id
       FROM principal_emails email
       JOIN principals principal ON principal.id = email.principal_id
      WHERE email.email = ? COLLATE NOCASE`,
  ).bind(invite.email).first<{ principal_id: string; connection_id: string | null }>();
  let principalId = current?.row.principal_id ?? mapped?.principal_id ?? null;
  const connectionId = current?.row.connection_id ?? mapped?.connection_id ?? null;
  if (!principalId) principalId = await createEmailPrincipal(db, invite.email);

  if (mapped && mapped.principal_id !== principalId) {
    principalId = await mergePrincipals(db, mapped.principal_id, principalId);
  }
  await db.batch([
    db.prepare(
      `INSERT INTO principal_emails (email, principal_id)
       VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET principal_id = excluded.principal_id`,
    ).bind(invite.email, principalId),
    db.prepare(
      "UPDATE principals SET email = COALESCE(email, ?) WHERE id = ?",
    ).bind(invite.email, principalId),
    db.prepare(
      `INSERT OR IGNORE INTO guest_access_grants
         (id, org_id, principal_id, scope_type, project_id, service, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(`noxgrant_${crypto.randomUUID().replaceAll("-", "")}`, invite.org_id, principalId,
      invite.scope_type, invite.project_id, invite.service, `invite:${invite.id}`),
  ]);

  const session = await createBrowserSession(db, principalId, connectionId);
  return callbackRedirect(env, "accepted", session, invite);
}

async function consumeLogin(request: Request, db: D1Database, env: GuestEnv, token: string): Promise<Response> {
  const tokenHash = await sha256(token);
  const login = await db.prepare(
    `SELECT token.principal_id, principal.github_connection_id AS connection_id
       FROM email_login_tokens token
       JOIN principals principal ON principal.id = token.principal_id
      WHERE token.token_hash = ? AND token.consumed_at IS NULL AND token.expires_at > ?`,
  ).bind(tokenHash, new Date().toISOString()).first<LoginTokenRow>();
  if (!login) return callbackRedirect(env, "expired");
  const consumed = await db.prepare(
    `UPDATE email_login_tokens
        SET consumed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE token_hash = ? AND consumed_at IS NULL RETURNING principal_id`,
  ).bind(tokenHash).first<LoginTokenRow>();
  if (!consumed) return callbackRedirect(env, "expired");
  const current = await resolvePrincipalCredential(request, db);
  const principalId = current && current.row.principal_id !== consumed.principal_id
    ? await mergePrincipals(db, consumed.principal_id, current.row.principal_id)
    : consumed.principal_id;
  const session = await createBrowserSession(db, principalId, current?.row.connection_id ?? login.connection_id ?? null);
  return callbackRedirect(env, "signed-in", session);
}

async function createEmailPrincipal(db: D1Database, email: string): Promise<string> {
  const uuid = crypto.randomUUID().replaceAll("-", "");
  const principalId = `email:${uuid}`;
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  const syntheticId = -((random[0] * 0x100000) + (random[1] & 0xfffff) + 1);
  await db.batch([
    db.prepare(
      `INSERT INTO principals
         (id, github_user_id, github_login, email, display_name)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(principalId, syntheticId, `guest-${uuid}`, email, email.split("@")[0]),
    db.prepare("INSERT INTO principal_emails (email, principal_id) VALUES (?, ?)").bind(email, principalId),
  ]);
  return principalId;
}

// Merge the source guest into the target signed-in identity. Provider-backed
// targets always win; all guest grants and verified email ownership survive.
export async function mergePrincipals(db: D1Database, sourceId: string, targetId: string): Promise<string> {
  if (sourceId === targetId) return targetId;
  const grants = await db.prepare(
    `SELECT org_id, scope_type, project_id, service, created_by
       FROM guest_access_grants WHERE principal_id = ? AND revoked_at IS NULL`,
  ).bind(sourceId).all<{
    org_id: number; scope_type: GuestScopeType; project_id: string | null; service: string | null; created_by: string;
  }>();
  const emails = await db.prepare(
    "SELECT email FROM principal_emails WHERE principal_id = ?",
  ).bind(sourceId).all<{ email: string }>();
  const statements: D1PreparedStatement[] = [
    ...grants.results.map((grant) => db.prepare(
      `INSERT OR IGNORE INTO guest_access_grants
         (id, org_id, principal_id, scope_type, project_id, service, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(`noxgrant_${crypto.randomUUID().replaceAll("-", "")}`, grant.org_id, targetId,
      grant.scope_type, grant.project_id, grant.service, grant.created_by)),
    ...emails.results.map((row) => db.prepare(
      "UPDATE principal_emails SET principal_id = ? WHERE email = ?",
    ).bind(targetId, row.email)),
    db.prepare("UPDATE principals SET email = NULL WHERE id = ?").bind(sourceId),
    db.prepare(
      `UPDATE principals SET email = COALESCE(email,
         (SELECT email FROM principal_emails WHERE principal_id = ? ORDER BY verified_at LIMIT 1))
       WHERE id = ?`,
    ).bind(targetId, targetId),
    db.prepare("DELETE FROM principals WHERE id = ?").bind(sourceId),
  ];
  await db.batch(statements);
  return targetId;
}

function validScope(scope: unknown, projectId: string | null, service: string | null): scope is GuestScopeType {
  return (scope === "organization" && !projectId && !service)
    || (scope === "project" && Boolean(projectId) && !service)
    || (scope === "tool" && Boolean(projectId) && Boolean(service));
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function callbackUrl(env: GuestEnv, token: string, kind: "invite" | "login"): string {
  const url = new URL("/auth/email/callback", env.PUBLIC_APP_ORIGIN);
  url.searchParams.set("kind", kind);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendEmail(
  env: GuestEnv,
  requestId: string,
  to: string,
  subject: string,
  heading: string,
  link: string,
  detail: string,
): Promise<void> {
  const receipt = await env.email.sendEmail({
    contract: "noxconnect.transactional-email",
    version: 1,
    requestId,
    recipient: to,
    template: subject.includes("invited") ? "platform.guest-invitation" : "platform.email-login",
    model: { subject, heading, detail, actionUrl: link },
  });
  if (receipt?.contract !== "noxconnect.transactional-email-receipt" || receipt.status !== "accepted") {
    throw new Error("NoxConnect returned an invalid email receipt");
  }
}

function callbackRedirect(
  env: GuestEnv,
  status: string,
  session?: { sessionToken: string; csrfToken: string },
  invite?: InviteRow,
): Response {
  const target = new URL("/", env.PUBLIC_APP_ORIGIN);
  target.searchParams.set("email", status);
  if (invite) {
    target.searchParams.set("org", invite.org_login);
    if (invite.project_id) target.searchParams.set("project", invite.project_id);
    if (invite.service) target.searchParams.set("tool", invite.service);
  }
  const headers = new Headers({ Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  if (session) for (const cookie of sessionCookies(session.sessionToken, session.csrfToken)) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function invitationScopeLabel(scope: GuestScopeType, projectName: string | null, service: string | null): string {
  if (scope === "organization") return "all projects and tools in the organization";
  if (scope === "project") return `all tools in ${projectName ?? "the project"}`;
  return `${service ?? "the selected tool"} in ${projectName ?? "the project"}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
