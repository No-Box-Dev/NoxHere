import { getCtx, jsonResponse } from "../../../lib/db";
import { buildIntegrationConnections } from "../../../lib/integration-connections.js";
import { onRequestGet as getIntegrationStatus } from "../status";
import { INTEGRATION_DISCOVERY_LINK } from "../../../lib/integration-discovery";
import { getNoxDb } from "../../../lib/nox-db";

interface Ctx {
  env: Record<string, unknown>;
  data: { orgId: number; orgLogin: string; isAdmin: boolean };
}

// Central NoxConnect contract. It preserves the detailed status payload used
// by the current UI and adds a provider registry that other Nox clients can
// render generically. Credentials and provider tokens never enter this shape.
export async function onRequestGet(context: Ctx): Promise<Response> {
  if (new URL((context as Ctx & { request: Request }).request.url).searchParams.get("view") === "bootstrap") {
    const { orgId, orgLogin } = getCtx(context) as Ctx["data"];
    const db = getNoxDb(context.env);
    const [installation, slack] = await Promise.all([
      db.prepare("SELECT installation_id FROM installations WHERE owner_id = ? LIMIT 1").bind(orgLogin).first<{ installation_id: number }>(),
      db.prepare("SELECT team_name FROM slack_connections WHERE org_id = ? ORDER BY is_default DESC, installed_at LIMIT 1").bind(orgId).first<{ team_name: string | null }>(),
    ]);
    const response = jsonResponse({
      github: { connected: Boolean(installation?.installation_id) },
      slack: { connected: Boolean(slack), teamName: slack?.team_name ?? null },
    });
    response.headers.set("Cache-Control", "private, max-age=30");
    return response;
  }
  const statusResponse = await getIntegrationStatus(context as never);
  if (!statusResponse.ok) return statusResponse;

  const overview = await statusResponse.json() as Record<string, unknown>;
  const { orgLogin } = getCtx(context) as Ctx["data"];
  const response = jsonResponse({
    apiVersion: 1,
    organization: { login: orgLogin },
    ...overview,
    connections: buildIntegrationConnections(overview),
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Link", INTEGRATION_DISCOVERY_LINK);
  return response;
}
