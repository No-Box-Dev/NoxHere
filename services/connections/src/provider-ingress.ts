import { onRequestPost as githubWebhook } from "../../../functions/api/webhook.js";
import { onRequestPost as postmarkWebhook } from "../../../functions/api/postmark/webhook";
import { onRequestPost as slackEvents } from "../../../functions/api/slack/events.js";
import { onRequestPost as slackInteractions } from "../../../functions/api/slack/interactions.js";
import { onRequestGet as slackOAuthCallback } from "../../../functions/api/slack/oauth/callback.js";
import { onRequestGet as slackOAuthHandoff } from "../../../functions/api/slack/oauth/handoff";
import { onRequestPost as slackOAuthStart } from "../../../functions/api/slack/oauth/start.js";
import { onRequestGet as slackStatus } from "../../../functions/api/slack/status.js";
import { onRequestGet as slackChannels } from "../../../functions/api/slack/channels.js";
import { onRequestPatch as updateSlackConnection } from "../../../functions/api/slack/connections/[id]";
import { onRequestPost as disconnectSlack } from "../../../functions/api/slack/disconnect.js";
import { onRequestPost as testSlack } from "../../../functions/api/slack/test.js";
import { onRequestPost as startIntegrationConnection } from "../../../functions/api/integrations/connections/[provider]/start.js";
import { verifyNoxHereAssertion } from "../../../functions/lib/noxhere-assertion";
import { checkSlackOrgHealth } from "../../../functions/lib/slack.js";
import { sendSlackMessage } from "./slack-message";

type NoxHereAssertion = NonNullable<Awaited<ReturnType<typeof verifyNoxHereAssertion>>>;

export interface ProviderIngressEnv {
  DB: D1Database;
  TASK_QUEUE: Queue;
  ENCRYPTION_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  POSTMARK_WEBHOOK_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_SIGNING_SECRET?: string;
  NOXHERE_INTERNAL_SECRET?: string;
  NOXHERE_INTERNAL_SECRET_PREVIOUS?: string;
  [key: string]: unknown;
}

interface ProviderIngressContext {
  request: Request;
  env: ProviderIngressEnv;
  waitUntil(work: Promise<unknown>): void;
  data?: NoxHereAssertion;
  params?: Record<string, string>;
}

const ROUTES = new Map<string, {
  method: "GET" | "POST";
  handler(context: ProviderIngressContext): Promise<Response>;
}>([
  ["/api/webhook", { method: "POST", handler: githubWebhook }],
  ["/api/postmark/webhook", { method: "POST", handler: postmarkWebhook }],
  ["/api/slack/events", { method: "POST", handler: slackEvents }],
  ["/api/slack/interactions", { method: "POST", handler: slackInteractions }],
  ["/api/slack/oauth/callback", { method: "GET", handler: slackOAuthCallback }],
  ["/api/slack/oauth/handoff", { method: "GET", handler: slackOAuthHandoff }],
]);

const AUTHENTICATED_ROUTES = new Map<string, {
  method: "GET" | "POST" | "PATCH";
  handler(context: ProviderIngressContext): Promise<Response>;
}>([
  ["/api/slack/oauth/start", { method: "POST", handler: slackOAuthStart }],
  ["/api/slack/status", { method: "GET", handler: slackStatus }],
  ["/api/slack/channels", { method: "GET", handler: slackChannels }],
  ["/api/slack/disconnect", { method: "POST", handler: disconnectSlack }],
  ["/api/slack/test", { method: "POST", handler: testSlack }],
]);

export async function handleProviderIngress(context: ProviderIngressContext): Promise<Response> {
  const url = new URL(context.request.url);
  if (url.pathname === "/__noxhere/provider-ingress/ready") {
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    return providerIngressReadiness(context.env);
  }

  const route = ROUTES.get(url.pathname);
  if (route) {
    if (context.request.method !== route.method) {
      return new Response(null, { status: 405, headers: { Allow: route.method } });
    }
    return route.handler(context);
  }

  const normalizedPath = url.pathname.replace(/^\/api\/v1\/slack\//, "/api/slack/");
  const connectionMatch = normalizedPath.match(/^\/api\/slack\/connections\/([^/]+)$/);
  const integrationStartMatch = url.pathname.match(/^\/api\/(?:v1\/)?integrations\/connections\/([^/]+)\/start$/);
  const authenticatedRoute = connectionMatch
    ? { method: "PATCH" as const, handler: updateSlackConnection }
    : integrationStartMatch
      ? { method: "POST" as const, handler: startIntegrationConnection }
      : AUTHENTICATED_ROUTES.get(normalizedPath);
  if (!authenticatedRoute) return Response.json({ error: "private_service" }, { status: 404 });
  if (context.request.method !== authenticatedRoute.method) {
    return new Response(null, { status: 405, headers: { Allow: authenticatedRoute.method } });
  }
  const assertion = await verifyNoxHereAssertion(
    context.request,
    context.env.NOXHERE_INTERNAL_SECRET,
    context.env.NOXHERE_INTERNAL_SECRET_PREVIOUS,
  ).catch(() => null);
  if (!assertion) {
    return Response.json({ apiVersion: 1, error: { code: "missing_internal_assertion", message: "Authenticated provider operations accept requests only from NoxHere" } }, {
      status: 401,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  const authenticatedContext = {
    ...context,
    // Authenticated Slack routes execute inside the credential-owning
    // Connections Worker. Supply its local capabilities explicitly instead
    // of expecting a circular CONNECTIONS service binding back to itself.
    env: {
      ...context.env,
      CONNECTIONS: {
        checkSlackOrgHealth: (orgId: number, connectionId: string) =>
          checkSlackOrgHealth(context.env, orgId, connectionId),
        sendSlackMessage: (input: unknown) => sendSlackMessage(context.env, input),
      },
    },
    data: assertion,
    params: connectionMatch
      ? { id: decodeURIComponent(connectionMatch[1]) }
      : integrationStartMatch ? { provider: decodeURIComponent(integrationStartMatch[1]) } : {},
  };
  return authenticatedRoute.handler(authenticatedContext);
}

export function providerIngressReadiness(env: ProviderIngressEnv): Response {
  const checks = {
    github: Boolean(env.GITHUB_WEBHOOK_SECRET),
    slack: Boolean(
      env.ENCRYPTION_KEY
      && env.SLACK_CLIENT_ID
      && env.SLACK_CLIENT_SECRET
      && env.SLACK_SIGNING_SECRET
    ),
    postmark: Boolean(env.POSTMARK_WEBHOOK_SECRET),
  };
  const ready = Object.values(checks).every(Boolean);
  return Response.json({
    service: "noxhere-connections",
    status: ready ? "ok" : "degraded",
    dependency: "provider-ingress",
    checks,
  }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
