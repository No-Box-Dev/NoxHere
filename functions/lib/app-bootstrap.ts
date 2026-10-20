export interface BootstrapProfile {
  login?: string;
  org?: string;
  accessLevel?: "member" | "guest" | "api_token";
  role?: "owner" | "admin" | "member" | "viewer" | "guest" | "automation";
  capabilities?: string[];
  isAdmin?: boolean;
  allowedServices?: string[];
}

export interface BootstrapProjectRow {
  id: string;
  name: string;
  org?: string | null;
  repo?: string | null;
  repositories?: string[];
  description?: string | null;
  archived?: number;
  routing_enabled?: number;
}

export interface BootstrapIntegrationStatus {
  github?: { connected?: boolean };
  slack?: { connected?: boolean; teamName?: string | null };
}

export function scopeBootstrapProjects(
  rows: BootstrapProjectRow[],
  credentialType: string | undefined,
  projectId: string | null | undefined,
): BootstrapProjectRow[] {
  if (credentialType !== "api_token") return rows;
  return projectId ? rows.filter((row) => row.id === projectId) : [];
}

const guestServiceMap: Readonly<Record<string, readonly string[]>> = {
  planning: ["planning"],
  activity: ["activity"],
  feedback: ["feedback"],
  growth: ["growth"],
  usage: ["usage"],
  issues: ["issues"],
  telemetry: ["growth", "usage", "issues"],
};

export function buildAppBootstrap(
  organizationId: string,
  profile: BootstrapProfile,
  projectRows: BootstrapProjectRow[],
  integration: BootstrapIntegrationStatus | null,
) {
  const accessLevel = profile.accessLevel === "guest" ? "guest" : "member";
  const isAdmin = profile.accessLevel !== "api_token" && Boolean(profile.isAdmin);
  const role = profile.accessLevel === "guest"
    ? "guest"
    : profile.role && profile.role !== "automation"
      ? profile.role
      : isAdmin ? "admin" : "member";
  const guestServices = profile.accessLevel === "guest"
    ? [...new Set((profile.allowedServices ?? []).flatMap((service) => guestServiceMap[service] ?? []))]
    : [];
  const projects = projectRows.flatMap((row) => {
    if (row.archived === 1 || row.routing_enabled === 0) return [];
    const connections: Array<{ id: string; provider: "github" | "slack"; label: string; status: "connected" | "attention" }> = [];
    const repositories = row.repositories?.length ? row.repositories : row.repo ? [row.repo] : [];
    for (const repo of repositories) {
      connections.push({
        id: `github-${row.id}-${repo}`,
        provider: "github",
        label: `${row.org ?? organizationId}/${repo}`,
        status: integration?.github?.connected ? "connected" : "attention",
      });
    }
    if (integration?.slack?.connected) {
      connections.push({
        id: `slack-${row.id}`,
        provider: "slack",
        label: integration.slack.teamName ?? "Slack",
        status: "connected",
      });
    }
    return [{
      id: row.id,
      name: row.name,
      organizationId,
      environment: row.description?.toLowerCase().includes("isolated project for safely testing") ? "test" : "production",
      connections,
    }];
  });
  const login = profile.login ?? "Member";
  return {
    apiVersion: 1,
    actor: {
      id: login,
      name: login,
      initials: login.slice(0, 2).toUpperCase(),
      accessLevel,
      role,
      capabilities: profile.capabilities ?? (isAdmin
        ? ["organization.manage", "members.manage", "guests.manage", "connections.manage", "repositories.manage", "tokens.manage", "growth.configure", "usage.configure", "issues.configure", "planning.configure"]
        : ["content.read", "content.write"]),
      isAdmin,
      allowedServiceIds: guestServices,
    },
    organization: { id: organizationId, name: profile.org ?? organizationId },
    projects,
  };
}
