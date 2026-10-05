export const GUEST_SERVICES = ["noxticket", "noxfeed", "noxspot", "noxcue"] as const;
export type GuestService = typeof GUEST_SERVICES[number];
export type GuestScopeType = "organization" | "project" | "tool";

export interface GuestGrantRow {
  id: string;
  scope_type: GuestScopeType;
  project_id: string | null;
  service: GuestService | null;
}

export interface GuestAccess {
  organizationWide: boolean;
  projects: Record<string, GuestService[] | null>;
}

export async function loadGuestAccess(
  db: D1Database,
  principalId: string,
  orgId: number,
): Promise<{ access: GuestAccess; grants: GuestGrantRow[] } | null> {
  const result = await db.prepare(
    `SELECT id, scope_type, project_id, service
       FROM guest_access_grants
      WHERE principal_id = ? AND org_id = ? AND revoked_at IS NULL`,
  ).bind(principalId, orgId).all<GuestGrantRow>();
  const grants = result.results;
  if (!grants.length) return null;

  const access: GuestAccess = { organizationWide: false, projects: {} };
  for (const grant of grants) {
    if (grant.scope_type === "organization") {
      access.organizationWide = true;
      continue;
    }
    if (!grant.project_id) continue;
    if (grant.scope_type === "project") {
      access.projects[grant.project_id] = null;
      continue;
    }
    if (!grant.service || access.projects[grant.project_id] === null) continue;
    const services = access.projects[grant.project_id] ?? [];
    if (!services.includes(grant.service)) services.push(grant.service);
    access.projects[grant.project_id] = services;
  }
  return { access, grants };
}

export function guestCanAccess(
  access: GuestAccess,
  projectId: string,
  service: string,
): boolean {
  if (access.organizationWide) return true;
  const services = access.projects[projectId];
  return services === null || Boolean(services?.includes(service as GuestService));
}

export function isGuestService(value: unknown): value is GuestService {
  return typeof value === "string" && GUEST_SERVICES.includes(value as GuestService);
}
