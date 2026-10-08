export type LastProject = { organizationId: string; projectId: string };

const prefix = "noxhere.last-project.";

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function key(userId: string) {
  return `${prefix}${userId.trim().toLowerCase()}`;
}

export function readLastProject(userId: string): LastProject | null {
  const raw = storage()?.getItem(key(userId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LastProject>;
    return typeof value.organizationId === "string" && value.organizationId
      && typeof value.projectId === "string" && value.projectId
      ? { organizationId: value.organizationId, projectId: value.projectId }
      : null;
  } catch { return null; }
}

export function saveLastProject(userId: string, project: LastProject) {
  storage()?.setItem(key(userId), JSON.stringify(project));
}

export function clearLastProject(userId: string, project?: LastProject) {
  const current = readLastProject(userId);
  if (!project || (current?.organizationId === project.organizationId && current.projectId === project.projectId)) {
    storage()?.removeItem(key(userId));
  }
}
