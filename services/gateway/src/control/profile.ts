import type { PrincipalCredentialRow } from "./auth";
import { apiResponse } from "./http";

interface MembershipProfile {
  login: string;
  role: "guest" | "member" | "admin";
}

interface ProfileGrant {
  login: string;
  scope_type: "organization" | "project" | "tool";
  project_id: string | null;
  service: string | null;
}

export async function profileResponse(
  db: D1Database,
  principal: PrincipalCredentialRow,
): Promise<Response> {
  const [memberships, guestOrganizations, grants] = await Promise.all([
    db.prepare(
      `SELECT org.github_login AS login, membership.role
         FROM org_memberships membership
         JOIN orgs org ON org.id = membership.org_id
        WHERE membership.principal_id = ? AND org.suspended_at IS NULL
        ORDER BY lower(org.github_login)`,
    ).bind(principal.principal_id).all<MembershipProfile>(),
    db.prepare(
      `SELECT DISTINCT org.github_login AS login, 'guest' AS role
         FROM guest_access_grants grant
         JOIN orgs org ON org.id = grant.org_id
        WHERE grant.principal_id = ? AND grant.revoked_at IS NULL
          AND org.suspended_at IS NULL
        ORDER BY lower(org.github_login)`,
    ).bind(principal.principal_id).all<MembershipProfile>(),
    db.prepare(
      `SELECT org.github_login AS login, grant.scope_type, grant.project_id, grant.service
         FROM guest_access_grants grant
         JOIN orgs org ON org.id = grant.org_id
        WHERE grant.principal_id = ? AND grant.revoked_at IS NULL
          AND org.suspended_at IS NULL`,
    ).bind(principal.principal_id).all<ProfileGrant>(),
  ]);
  const organizations = new Map<string, MembershipProfile>();
  for (const membership of guestOrganizations.results) organizations.set(membership.login.toLowerCase(), membership);
  for (const membership of memberships.results) organizations.set(membership.login.toLowerCase(), membership);
  return apiResponse({
    user: {
      id: principal.github_user_id,
      login: principal.github_login,
      email: principal.email ?? null,
      name: principal.display_name ?? principal.github_login,
      avatar_url: principal.avatar_url ?? "",
      githubConnected: Boolean(principal.connection_id && !principal.github_login.startsWith("guest-")),
    },
    orgs: [...organizations.values()].sort((left, right) => left.login.localeCompare(right.login)).map((membership) => {
      const rows = grants.results.filter((grant) => grant.login.toLowerCase() === membership.login.toLowerCase());
      const organizationWide = rows.some((grant) => grant.scope_type === "organization");
      const projects: Record<string, string[] | null> = {};
      for (const grant of rows) {
        if (!grant.project_id) continue;
        if (grant.scope_type === "project") projects[grant.project_id] = null;
        else if (grant.service && projects[grant.project_id] !== null) {
          const services = projects[grant.project_id] ?? [];
          if (!services.includes(grant.service)) services.push(grant.service);
          projects[grant.project_id] = services;
        }
      }
      return {
        login: membership.login,
        role: membership.role,
        guestAccess: membership.role === "guest" ? { organizationWide, projects } : null,
      };
    }),
  });
}
