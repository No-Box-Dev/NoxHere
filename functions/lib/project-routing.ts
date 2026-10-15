export const PROJECT_ROUTE_KEYS = [
  "activity_posts",
  "activity_release_notes",
  "telemetry",
  "telemetry_alerts",
] as const;

export type ProjectRouteKey = typeof PROJECT_ROUTE_KEYS[number];

export interface ProjectSlackDestination {
  projectId: string;
  projectName: string;
  connectionId: string;
  channelId: string;
}

interface SlackEnvironment {
  CONNECTIONS?: {
    validateSlackDestination(input: unknown): Promise<unknown>;
  };
}

interface SlackDestinationValidationResult {
  ok: boolean;
  result?: { connectionId: string };
  error?: { code: string; message: string; status?: number };
}

export class ProjectSlackDestinationError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "ProjectSlackDestinationError";
    this.status = status;
  }
}

export function projectSlackDestinationErrorStatus(error: unknown): number {
  return error instanceof ProjectSlackDestinationError ? error.status : 503;
}

export async function validateProjectSlackDestination(
  env: SlackEnvironment,
  orgId: number,
  projectId: string | null,
  destination: { connectionId: string | null; channelId: string | null },
): Promise<string | null> {
  const connectionId = destination.connectionId?.trim() ?? "";
  const channelId = destination.channelId?.trim() ?? "";
  if (Boolean(connectionId) !== Boolean(channelId)) {
    throw new Error("Workspace and channel must be selected together");
  }
  if (!channelId) return null;

  if (!env.CONNECTIONS?.validateSlackDestination) {
    throw new ProjectSlackDestinationError("Slack channel validation is temporarily unavailable", 503);
  }

  let validation: SlackDestinationValidationResult;
  try {
    const raw = await env.CONNECTIONS.validateSlackDestination({ orgId, projectId, connectionId, channelId });
    if (!raw || typeof raw !== "object" || !("ok" in raw) || typeof raw.ok !== "boolean") {
      throw new Error("Invalid Connections response");
    }
    validation = raw as SlackDestinationValidationResult;
  } catch {
    throw new ProjectSlackDestinationError("Slack channel validation is temporarily unavailable", 503);
  }
  if (!validation.ok || !validation.result?.connectionId) {
    throw new ProjectSlackDestinationError(
      validation.error?.message ?? "Slack channel is unavailable",
      validation.error?.status === 400 ? 400 : validation.error?.status === 503 ? 503 : 409,
    );
  }
  return validation.result.connectionId;
}

interface RouteRow {
  project_id: string;
  project_name: string;
  connection_id: string;
  channel_id: string;
}

export async function resolveProjectSlackDestination(
  db: D1Database,
  orgId: number,
  routeKey: ProjectRouteKey,
  subject: { projectId?: string | null; repo?: string | null },
): Promise<ProjectSlackDestination | null> {
  if (!db || !orgId || (!subject.projectId && !subject.repo)) return null;

  const byProject = Boolean(subject.projectId);
  const row = await db.prepare(
    `SELECT project.id AS project_id, project.name AS project_name,
            route.connection_id, route.channel_id
       FROM project_slack_routes route
       JOIN projects project ON project.id = route.project_id
       JOIN project_routing_settings settings
         ON settings.org_id = route.org_id AND settings.project_id = route.project_id
       ${byProject ? "" : "JOIN project_repositories assignment ON assignment.project_id = route.project_id AND assignment.org_id = route.org_id"}
      WHERE route.org_id = ? AND route.route_key = ?
        AND settings.enabled = 1
        AND ${byProject ? "route.project_id = ?" : "assignment.repo = ?"}
      LIMIT 1`,
  ).bind(orgId, routeKey, byProject ? subject.projectId : subject.repo).first<RouteRow>();
  if (!row) return null;
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    connectionId: row.connection_id,
    channelId: row.channel_id,
  };
}
