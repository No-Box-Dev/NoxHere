import { DEFAULT_API_BASE, normalizedSession, refreshSession } from "./auth.mjs";

function organizationLogin(organization) {
  return typeof organization === "string" ? organization : organization?.login;
}

export function organizationLogins(session) {
  return (session.organizations || []).map(organizationLogin).filter(Boolean);
}

export function projectsFromPayload(payload) {
  return Array.isArray(payload) ? payload : payload?.projects || [];
}

export function resolveProject(projects, reference) {
  const needle = reference.toLowerCase();
  return projects.find((project) => [project.id, project.slug, project.name]
    .some((value) => typeof value === "string" && value.toLowerCase() === needle)) || null;
}

const CAPABILITIES = new Set(["activity", "incidents", "issues", "feedback"]);

export function projectCapabilityPath(session, capability) {
  if (!CAPABILITIES.has(capability)) throw new Error(`Unknown NoxConnect capability '${capability}'.`);
  const project = session.context?.project;
  if (!project) throw new Error("Choose a project with `noxconnect use <organization>/<project>`.");
  return `/api/v1/projects/${encodeURIComponent(project)}/${capability}`;
}

export async function ensureAccess(session, save, options = {}) {
  const expiresAt = Date.parse(session.accessExpiresAt || "");
  if (session.accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000) return session;
  if (!session.refreshToken) throw new Error("Your NoxConnect session expired. Run `noxconnect login` again.");
  const refresh = async () => {
    const latest = await options.load?.() || session;
    const latestExpiry = Date.parse(latest.accessExpiresAt || "");
    if (latest.accessToken && Number.isFinite(latestExpiry) && latestExpiry > Date.now() + 30_000) return latest;
    if (!latest.refreshToken) throw new Error("Your NoxConnect session expired. Run `noxconnect login` again.");
    const result = await refreshSession(latest.refreshToken, {
      baseURL: latest.apiBase || DEFAULT_API_BASE,
      fetchImpl: options.fetchImpl,
    });
    const next = normalizedSession(result, latest);
    await save(next);
    return next;
  };
  return options.withRefreshLock ? options.withRefreshLock(refresh) : refresh();
}

export async function apiRequest(session, path, {
  method = "GET",
  body,
  fetchImpl = fetch,
  save = async () => {},
  load,
  withRefreshLock,
} = {}) {
  const active = await ensureAccess(session, save, { fetchImpl, load, withRefreshLock });
  const org = active.context?.organization;
  if (!org) throw new Error("Choose an organization with `noxconnect use <organization>`.");
  const url = new URL(path, active.apiBase || DEFAULT_API_BASE);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${active.accessToken}`,
    "X-Org": org,
  });
  if (active.context?.project) headers.set("X-Project-ID", active.context.project);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetchImpl(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = text; }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return { payload, session: active };
}

export function selectContext(session, selection) {
  const [organization, ...projectParts] = selection.split("/").filter(Boolean);
  if (!organization) throw new Error("Use `noxconnect use <organization>` or `noxconnect use <organization>/<project>`.");
  const known = organizationLogins(session);
  const canonical = known.find((value) => value.toLowerCase() === organization.toLowerCase());
  if (!canonical) throw new Error(`Organization '${organization}' is not available to this login.`);
  return {
    ...session,
    context: {
      organization: canonical,
      project: projectParts.length ? projectParts.join("/") : null,
    },
  };
}
