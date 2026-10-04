import { getCtx, errorResponse, jsonResponse } from "../../../lib/db";
import { onRequestPut as putConfig } from "../../config/[key].js";
import { z } from "zod";
import { validate } from "../../../lib/validate";
import { readSlackSettings } from "../../../lib/slack-settings";
import { requeueBlockedTransportCommands } from "../../../lib/transport-outbox";

interface Ctx {
  env: Pick<Env, "DB" | "TASK_QUEUE">;
  data: { orgId: number; projectId?: string | null; isAdmin: boolean };
  request: Request;
  params?: Record<string, string>;
}

const ROUTES: Record<string, { channel: string; connection: string }> = {
  fallback: { channel: "fallbackChannelId", connection: "fallbackConnectionId" },
  noxcue: { channel: "noxCueChannelId", connection: "noxCueConnectionId" },
  noxticket: { channel: "noxTicketChannelId", connection: "noxTicketConnectionId" },
  noxfeed_posts: { channel: "postsChannelId", connection: "postsConnectionId" },
  noxfeed_release_notes: { channel: "releaseNotesChannelId", connection: "releaseNotesConnectionId" },
  noxfeed_daily_summary: { channel: "dailySummaryChannelId", connection: "dailySummaryConnectionId" },
};

const RoutingPatch = z.object({
  routes: z.record(z.string(), z.string().trim().max(80).nullable()),
  connections: z.record(z.string(), z.string().trim().max(80).nullable()).optional(),
});

interface SlackConnectionCandidate {
  id: string;
  project_id: string | null;
  is_default: number;
  channel_status: string | null;
}

interface SlackRouteIntegrityIssue {
  route: string;
  code: "missing_workspace" | "unknown_workspace";
}

async function inspectRouteIntegrity(
  db: D1Database,
  orgId: number,
  slack: Record<string, unknown>,
): Promise<{ valid: boolean; issues: SlackRouteIntegrityIssue[] }> {
  const configured = Object.entries(ROUTES).flatMap(([route, fields]) => {
    const channelId = typeof slack[fields.channel] === "string" ? String(slack[fields.channel]).trim() : "";
    const connectionId = typeof slack[fields.connection] === "string" ? String(slack[fields.connection]).trim() : "";
    return channelId ? [{ route, connectionId }] : [];
  });
  if (configured.length === 0) return { valid: true, issues: [] };

  const { results = [] } = await db.prepare(
    "SELECT id FROM slack_connections WHERE org_id = ?",
  ).bind(orgId).all<{ id: string }>();
  const available = new Set((results ?? []).map((row) => row.id));
  const issues = configured.flatMap(({ route, connectionId }): SlackRouteIntegrityIssue[] => {
    if (!connectionId) return [{ route, code: "missing_workspace" }];
    if (!available.has(connectionId)) return [{ route, code: "unknown_workspace" }];
    return [];
  });
  return { valid: issues.length === 0, issues };
}

// Compatibility for clients released before routes carried a connection ID.
// A channel ID is only meaningful together with the workspace whose token can
// access it, so infer only when the result is deterministic. In priority order:
// a previously verified workspace/channel pair, the project's assigned
// workspace, or the organization's sole Slack installation.
async function inferSlackConnection(
  db: D1Database,
  orgId: number,
  projectId: string | null | undefined,
  channelId: string,
): Promise<string | null> {
  const { results = [] } = await db.prepare(
    `SELECT connection.id, connection.project_id, connection.is_default,
            channel.status AS channel_status
       FROM slack_connections connection
       LEFT JOIN slack_channel_status channel
         ON channel.org_id = connection.org_id
        AND channel.slack_connection_id = connection.id
        AND channel.channel_id = ?
      WHERE connection.org_id = ?
      ORDER BY connection.is_default DESC, connection.installed_at ASC`,
  ).bind(channelId, orgId).all<SlackConnectionCandidate>();

  const candidates = results ?? [];
  const verified = candidates.filter((candidate) => candidate.channel_status === "verified");
  if (verified.length === 1) return verified[0].id;

  if (projectId) {
    const assigned = candidates.filter((candidate) => candidate.project_id === projectId);
    if (assigned.length === 1) return assigned[0].id;
  }

  return candidates.length === 1 ? candidates[0].id : null;
}

function routingResponse(settings: Record<string, unknown>) {
  const slack: Record<string, unknown> = settings.slack && typeof settings.slack === "object" && !Array.isArray(settings.slack)
    ? settings.slack as Record<string, unknown>
    : {};
  const routes = Object.fromEntries(Object.entries(ROUTES).map(([name, fields]) => [name, slack[fields.channel] || null]));
  const connections = Object.fromEntries(Object.entries(ROUTES).map(([name, fields]) => [name, slack[fields.connection] || null]));
  return {
    routes,
    connections,
    resolution: {
      noxcue: ["noxcue", "fallback"],
      noxticket: ["noxticket", "fallback"],
      noxfeed_posts: ["noxfeed_posts", "fallback"],
      noxfeed_release_notes: ["noxfeed_release_notes", "fallback"],
      noxfeed_daily_summary: ["noxfeed_daily_summary"],
      noxspot: ["site channel", "fallback"],
    },
  };
}

// GET /api/integrations/slack/routing
export async function onRequestGet(context: Ctx): Promise<Response> {
  const { orgId, projectId, isAdmin } = getCtx(context);
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  try {
    const stored = await readSlackSettings(context.env.DB, orgId, projectId);
    const integrity = await inspectRouteIntegrity(context.env.DB, orgId, stored.slack);
    return jsonResponse({ ...routingResponse(stored.settings), integrity });
  }
  catch (error) { return errorResponse(error instanceof Error ? error.message : String(error), 500); }
}

// PATCH /api/integrations/slack/routing
// Body: { routes: { fallback?: string|null, ... }, connections?: { fallback?: string|null, ... } }
// Partial updates are merged so an agent cannot accidentally erase unrelated
// organization settings by writing the generic config document.
export async function onRequestPatch(context: Ctx): Promise<Response> {
  const { orgId, projectId, isAdmin } = getCtx(context);
  if (!orgId) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);

  let raw: unknown;
  try { raw = await context.request.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = validate(RoutingPatch, raw);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const unknown = Object.keys(body.routes).filter((key) => !ROUTES[key]);
  const unknownConnections = Object.keys(body.connections ?? {}).filter((key) => !ROUTES[key]);
  if (unknown.length || unknownConnections.length) return errorResponse(`Unknown Slack route: ${[...unknown, ...unknownConnections].join(", ")}`, 400);

  let stored;
  try { stored = await readSlackSettings(context.env.DB, orgId, projectId); }
  catch (error) { return errorResponse(error instanceof Error ? error.message : String(error), 500); }
  const settings = stored.settings;
  const slack: Record<string, unknown> = { ...stored.slack };
  for (const [route, value] of Object.entries(body.routes)) {
    const fields = ROUTES[route];
    const channelId = typeof value === "string" ? value.trim() : "";
    const previousChannelId = typeof slack[fields.channel] === "string" ? String(slack[fields.channel]).trim() : "";
    const previousConnectionId = typeof slack[fields.connection] === "string" ? String(slack[fields.connection]).trim() : "";
    const hasExplicitConnection = Object.prototype.hasOwnProperty.call(body.connections ?? {}, route);
    const explicitConnectionId = hasExplicitConnection && typeof body.connections?.[route] === "string"
      ? body.connections[route]!.trim()
      : "";

    slack[fields.channel] = channelId;
    if (!channelId) {
      // A route is one atomic (workspace, channel) pair. Do not leave a stale
      // workspace behind when its channel is cleared.
      slack[fields.connection] = "";
      continue;
    }
    if (hasExplicitConnection) {
      if (!explicitConnectionId) return errorResponse(`Choose a Slack workspace for the ${route} channel`, 409);
      slack[fields.connection] = explicitConnectionId;
      continue;
    }
    if (channelId === previousChannelId && previousConnectionId) continue;

    const inferredConnectionId = await inferSlackConnection(context.env.DB, orgId, projectId, channelId);
    if (!inferredConnectionId) {
      return errorResponse(
        `Choose a Slack workspace for the ${route} channel. This organization has multiple Slack workspaces, so the channel alone is ambiguous.`,
        409,
      );
    }
    slack[fields.connection] = inferredConnectionId;
  }
  for (const [route, value] of Object.entries(body.connections ?? {})) {
    if (Object.prototype.hasOwnProperty.call(body.routes, route)) continue;
    const fields = ROUTES[route];
    const channelId = typeof slack[fields.channel] === "string" ? String(slack[fields.channel]).trim() : "";
    const connectionId = typeof value === "string" ? value.trim() : "";
    if (channelId && !connectionId) return errorResponse(`Choose a Slack workspace for the ${route} channel`, 409);
    slack[fields.connection] = connectionId;
  }
  // Once either split NoxFeed route is managed through the canonical API,
  // retire the old combined value so it cannot silently override a cleared
  // posts or release-notes route during the compatibility window.
  if (Object.prototype.hasOwnProperty.call(body.routes, "noxfeed_posts")
    || Object.prototype.hasOwnProperty.call(body.routes, "noxfeed_release_notes")) {
    delete slack.noxFeedChannelId;
  }
  const nextSettings = { ...settings, slack };
  const request = new Request(context.request.url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextSettings),
  });
  const response = await putConfig({
    ...context,
    request,
    params: { ...context.params, key: "settings" },
    data: {
      ...context.data,
      configCompareAndSwap: { expectedRaw: stored.raw },
    },
  } as never);
  if (!response.ok) return response;
  await requeueBlockedTransportCommands(context.env, { orgId, projectId });
  return jsonResponse({
    ok: true,
    ...routingResponse(nextSettings),
    integrity: await inspectRouteIntegrity(context.env.DB, orgId, slack),
  });
}
