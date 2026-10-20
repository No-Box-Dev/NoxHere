import { onRequestGet as getProfile } from "../me.js";
import { onRequestGet as getProjects } from "../projects.js";
import { getBootstrapIntegrationStatus } from "../integrations/connections/index";
import { buildAppBootstrap, scopeBootstrapProjects, type BootstrapIntegrationStatus, type BootstrapProfile, type BootstrapProjectRow } from "../../lib/app-bootstrap";
import { getCtx, jsonResponse } from "../../lib/db";

interface BootstrapContext {
  request: Request;
  env: Record<string, unknown>;
  data: { orgLogin: string; projectId?: string | null; auth?: { type?: string } };
}

async function body<T>(response: Response): Promise<T> {
  if (!response.ok) throw response;
  return response.json<T>();
}

export async function onRequestGet(context: BootstrapContext): Promise<Response> {
  const profileResponse = await getProfile(context as never);
  if (!profileResponse.ok) return profileResponse;

  // Projects may reconcile a newly installed GitHub App before reading. Keep
  // that operation ahead of the connection summary so this single response is
  // internally consistent for a first-time organization.
  const projectsResponse = await getProjects(context as never);
  if (!projectsResponse.ok) return projectsResponse;
  const [profile, projectPayload, integration] = await Promise.all([
    body<BootstrapProfile>(profileResponse),
    body<{ projects?: BootstrapProjectRow[] }>(projectsResponse),
    getBootstrapIntegrationStatus(context as never) as Promise<BootstrapIntegrationStatus>,
  ]);
  const { orgLogin, projectId, auth } = getCtx(context) as BootstrapContext["data"];
  const requestedOrganization = context.request.headers.get("X-Org")?.trim() || orgLogin;
  const projects = scopeBootstrapProjects(projectPayload.projects ?? [], auth?.type, projectId);
  const response = jsonResponse(buildAppBootstrap(requestedOrganization, profile, projects, integration));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
