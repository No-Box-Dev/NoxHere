import { getCtx } from "../../../lib/db";
import { buildServiceCatalog } from "../../../lib/service-capabilities";
import { loadServiceManifests, type ProductServiceEnvironment } from "../../../lib/service-manifests";
import type { NoxDatabaseEnv } from "../../../lib/nox-db";
import { API_VERSION, normalizeLegacyError, v1Error, v1Response } from "../../../lib/api-v1";
import { onRequestGet as getIntegrationStatus } from "../../integrations/status";

export interface ServiceCatalogContext {
  env: NoxDatabaseEnv & ProductServiceEnvironment & {
    GITHUB_APP_ID?: string;
    GITHUB_APP_PRIVATE_KEY?: string;
    SLACK_CLIENT_ID?: string;
    SLACK_CLIENT_SECRET?: string;
    SLACK_SIGNING_SECRET?: string;
    SLACK_APP_ID?: string;
    SLACK_ACCEPT_LEGACY_INSTALLS?: string;
  };
  data: { orgId: number; projectId?: string | null; orgLogin: string; isAdmin: boolean };
}

interface IntegrationStatus {
  github: {
    configured: boolean;
    connected: boolean;
    bootstrapping: boolean;
    health: string;
  };
  slack: {
    configured: boolean;
    connected: boolean;
    needsReconnect: boolean;
    health: string;
  };
}

export async function loadServiceCatalog(context: ServiceCatalogContext) {
  const { orgId, projectId, orgLogin, isAdmin } = getCtx(context) as ServiceCatalogContext["data"];
  if (!orgId || !orgLogin) return { response: v1Error("missing_org_context", "Missing organization context", 400) };
  const [statusResponse, serviceManifests] = await Promise.all([
    getIntegrationStatus(context as never),
    loadServiceManifests(context.env),
  ]);
  if (!statusResponse.ok) return { response: await normalizeLegacyError(statusResponse) };

  const integrations = await statusResponse.json() as IntegrationStatus;
  return {
    body: {
      apiVersion: API_VERSION,
      organization: { login: orgLogin },
      project: projectId ? { id: projectId } : null,
      canConfigure: Boolean(isAdmin),
      services: buildServiceCatalog({
        integrations,
        definitions: serviceManifests.definitions,
        runtimeStates: serviceManifests.runtimeStates,
      }),
    },
  };
}

// GET /api/v1/services — capability-first discovery for every Nox service.
export async function onRequestGet(context: ServiceCatalogContext): Promise<Response> {
  const result = await loadServiceCatalog(context);
  if (result.response) return result.response;

  return v1Response(result.body);
}
