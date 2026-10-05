import type { AuthContext } from "./auth";

const MAX_CONTROL_RESPONSE_BYTES = 256 * 1024;

interface ServiceBody {
  [key: string]: unknown;
}

export async function mirrorAndOverlayResponse(
  request: Request,
  response: Response,
  db: D1Database,
  auth: AuthContext,
): Promise<Response> {
  if (!response.ok) return response;
  const url = new URL(request.url);
  const isProjectRouting = /^\/api\/(?:v1\/)?projects\/routing(?:\/[^/]+)?$/.test(url.pathname);
  const isProjectCreation = request.method === "POST" && /^\/api\/(?:v1\/)?projects$/.test(url.pathname);
  if (!isProjectRouting && !isProjectCreation) return response;
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_CONTROL_RESPONSE_BYTES) return response;

  let body: ServiceBody;
  try { body = await response.clone().json<ServiceBody>(); }
  catch { return response; }

  await mirrorProjects(request, body, db, auth);
  return response;
}

async function mirrorProjects(
  request: Request,
  body: ServiceBody,
  db: D1Database,
  auth: AuthContext,
): Promise<void> {
  if (!auth.isAdmin) return;
  const candidate = body as { projects?: unknown; project?: unknown; ok?: unknown; projectId?: unknown; enabled?: unknown; repositories?: unknown };
  if (request.method === "POST" && candidate.project && typeof candidate.project === "object") {
    const project = candidate.project as Record<string, unknown>;
    if (typeof project.id === "string" && typeof project.name === "string") {
      await persistProject(db, auth.orgId, project.id, project.name, true, false, []);
    }
    return;
  }
  if (request.method === "GET" && Array.isArray(candidate.projects)) {
    for (const raw of candidate.projects) {
      if (!raw || typeof raw !== "object") continue;
      const project = raw as Record<string, unknown>;
      if (typeof project.id !== "string" || typeof project.name !== "string") continue;
      const repositories = Array.isArray(project.repositories)
        ? project.repositories.filter((repo): repo is string => typeof repo === "string")
        : [];
      await persistProject(db, auth.orgId, project.id, project.name, Boolean(project.enabled), Boolean(project.archived), repositories);
    }
  }
  if (request.method === "PUT" && candidate.ok === true
      && typeof candidate.projectId === "string"
      && typeof candidate.enabled === "boolean"
      && Array.isArray(candidate.repositories)) {
    const existing = await db.prepare("SELECT name, archived FROM projects WHERE id = ? AND org_id = ?")
      .bind(candidate.projectId, auth.orgId).first<{ name: string; archived: number }>();
    if (!existing) return;
    await persistProject(
      db,
      auth.orgId,
      candidate.projectId,
      existing.name,
      candidate.enabled,
      existing.archived === 1,
      candidate.repositories.filter((repo): repo is string => typeof repo === "string"),
    );
  }
}

async function persistProject(
  db: D1Database,
  orgId: number,
  id: string,
  name: string,
  enabled: boolean,
  archived: boolean,
  repositories: string[],
): Promise<void> {
  await db.batch([
    db.prepare(
      `INSERT INTO projects (id, org_id, name, archived, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         archived = excluded.archived,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at
       WHERE projects.org_id = excluded.org_id`,
    ).bind(id, orgId, name, archived ? 1 : 0, enabled ? 1 : 0),
    db.prepare("DELETE FROM project_repositories WHERE org_id = ? AND project_id = ?").bind(orgId, id),
    ...repositories.slice(0, 500).map((repo) => db.prepare(
      `INSERT INTO project_repositories (org_id, repo, project_id)
       VALUES (?, ?, ?)
       ON CONFLICT(org_id, repo) DO UPDATE SET project_id = excluded.project_id`,
    ).bind(orgId, repo, id)),
  ]);
}
