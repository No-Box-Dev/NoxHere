import type { AuthContext } from "./auth";
import { apiError, apiResponse, boundedJson } from "./http";

const ADMIN_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
type ManagedRole = "admin" | "member" | "viewer";

export async function handleMembershipControl(request: Request, db: D1Database, auth: AuthContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/audit-log" && request.method === "GET") {
    if (!auth.isAdmin || !auth.capabilities?.includes("organization.manage")) return apiError("admin_required", "Organization admin access is required", 403);
    const rows = await db.prepare(
      `SELECT id, actor_type AS actorType, actor_id AS actorId, action, target_id AS targetId,
              metadata_json AS metadataJson, created_at AS createdAt
         FROM auth_audit_log WHERE org_id = ? ORDER BY id DESC LIMIT 100`,
    ).bind(auth.orgId).all<Record<string, unknown>>();
    return apiResponse({ events: rows.results.map((row) => ({ ...row, metadata: parseMetadata(row.metadataJson), metadataJson: undefined })) });
  }
  if (url.pathname === "/api/v1/memberships" && request.method === "GET") {
    if (auth.accessLevel !== "member") return apiError("member_required", "Organization membership is required", 403);
    const rows = await db.prepare(
      `SELECT membership.principal_id AS principalId, principal.github_login AS login,
              principal.avatar_url AS avatarUrl, membership.role AS providerRole,
              membership.managed_role AS managedRole, membership.verified_at AS verifiedAt
         FROM org_memberships membership
         JOIN principals principal ON principal.id = membership.principal_id
        WHERE membership.org_id = ?
        ORDER BY lower(principal.github_login)`,
    ).bind(auth.orgId).all<Record<string, unknown>>();
    return apiResponse({ members: rows.results.map((row) => ({
      ...row,
      role: row.providerRole === "admin" ? "owner" : row.managedRole ?? "member",
      roleSource: row.providerRole === "admin" ? "github" : row.managedRole ? "noxhere" : "github",
    })) });
  }

  const principalId = url.pathname.match(/^\/api\/v1\/memberships\/([^/]+)$/)?.[1];
  if (!principalId || request.method !== "PATCH") return null;
  if (!auth.isAdmin || !auth.capabilities?.includes("members.manage")) return apiError("admin_required", "Organization admin access is required", 403);
  if (!freshAdmin(auth)) return apiError("membership_refresh_required", "Refresh your verified GitHub membership before changing access", 403);
  let body: { role?: unknown };
  try { body = await boundedJson(request, 4 * 1024); }
  catch { return apiError("invalid_request", "Choose a valid member role", 400); }
  if (!isManagedRole(body.role)) return apiError("invalid_role", "Role must be admin, member, or viewer", 400);
  const target = await db.prepare(
    "SELECT role, managed_role FROM org_memberships WHERE org_id = ? AND principal_id = ?",
  ).bind(auth.orgId, decodeURIComponent(principalId)).first<{ role: string; managed_role: string | null }>();
  if (!target) return apiError("member_not_found", "The member is unavailable", 404);
  if (target.role === "admin") return apiError("owner_role_managed_by_github", "GitHub organization owners cannot be demoted in NoxHere", 409);
  await db.batch([
    db.prepare("UPDATE org_memberships SET managed_role = ? WHERE org_id = ? AND principal_id = ?")
      .bind(body.role, auth.orgId, decodeURIComponent(principalId)),
    audit(db, auth, "membership.role_changed", decodeURIComponent(principalId), { previousRole: target.managed_role ?? "member", role: body.role }),
  ]);
  return apiResponse({ updated: true, role: body.role });
}

export function freshAdmin(auth: AuthContext): boolean {
  if (!auth.isAdmin || !auth.membershipVerifiedAt) return false;
  const verified = Date.parse(auth.membershipVerifiedAt);
  return Number.isFinite(verified) && Date.now() - verified <= ADMIN_VERIFICATION_MAX_AGE_MS;
}

export function sensitiveAdminMutation(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return false;
  const pathname = new URL(request.url).pathname;
  return pathname === "/api/v1/projects"
    || /^\/api\/v1\/projects\/[^/]+\/(routing|archive)$/.test(pathname)
    || /^\/api\/v1\/(integrations|slack)(?:\/|$)/.test(pathname)
    || /^\/api\/v1\/(config|llm-settings|cues\/sources|spots\/sites)(?:\/|$)/.test(pathname);
}

export function audit(db: D1Database, auth: AuthContext, action: string, targetId: string, metadata: Record<string, unknown> = {}): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_audit_log (org_id, actor_type, actor_id, action, target_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(auth.orgId, auth.credentialType === "api_token" ? "api_token" : "user", auth.userLogin, action, targetId, JSON.stringify(metadata));
}

function isManagedRole(value: unknown): value is ManagedRole {
  return value === "admin" || value === "member" || value === "viewer";
}

function parseMetadata(value: unknown): Record<string, unknown> {
  try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; }
  catch { return {}; }
}
