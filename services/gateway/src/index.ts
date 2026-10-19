import { createTelemetry } from "../../../packages/sdk/src/telemetry/server.js";
import { apiError } from "./control/http";

type BoundService = {
  fetch(request: Request): Promise<Response>;
};

export interface PlatformServices {
  assets: BoundService;
  connector: BoundService;
  provider?: BoundService;
  feedback?: BoundService;
  control?: {
    db: D1Database;
    identity: import("./control/oauth").IdentityService;
    email?: import("./control/oauth").EmailService;
    assertionSecret?: string;
    guestEmail?: Omit<import("./control/guests").GuestEnv, "email">;
  };
  background?: (work: Promise<unknown>) => void;
}

const API_PREFIX = "/api/";
const HEALTH_PATH = "/__noxhere/health";
const PRIVATE_BOUNDARY_HEALTH_PATH = "/__noxhere/health/private-boundary";
const IDENTITY_BOUNDARY_HEALTH_PATH = "/__noxhere/health/identity-boundary";
const PROVIDER_INGRESS_HEALTH_PATH = "/__noxhere/health/provider-ingress";

function gatewayResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-NoxHere-Gateway", "1");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  if (!headers.has("Link")) headers.set("Link", '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"');
  if (!headers.has("X-Content-Type-Options")) headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unavailableResponse(): Response {
  return Response.json(
    {
      apiVersion: 1,
      error: {
        code: "service_unavailable",
        message: "The NoxHere integration service is temporarily unavailable.",
        remediation: { action: "retry" },
      },
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "5",
        "X-Content-Type-Options": "nosniff",
        "X-NoxHere-Gateway": "1",
      },
    },
  );
}

function staleMembershipResponse(): Response {
  return Response.json(
    {
      apiVersion: 1,
      error: {
        code: "membership_verification_unavailable",
        message: "GitHub organization membership could not be verified. Try again shortly.",
        remediation: { action: "retry" },
      },
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "30",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function handleRequest(
  request: Request,
  services: PlatformServices,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === HEALTH_PATH) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    return Response.json({
      service: "noxhere",
      owner: "noxhere",
      plane: "public-platform",
      status: "ok",
      apiVersion: 1,
    });
  }

  if (url.pathname === PRIVATE_BOUNDARY_HEALTH_PATH) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    return privateBoundaryHealth(request, services);
  }

  if (url.pathname === IDENTITY_BOUNDARY_HEALTH_PATH) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    return identityBoundaryHealth(services);
  }

  if (url.pathname === PROVIDER_INGRESS_HEALTH_PATH) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    if (!services.provider) return unavailableResponse();
    const target = new URL("/__noxhere/provider-ingress/ready", request.url);
    target.search = url.search;
    return gatewayResponse(await services.provider.fetch(new Request(target, request)));
  }

  if (url.pathname === "/auth/github/callback") {
    const control = services.control;
    if (!control) return unavailableResponse();
    try {
      const { handleOAuthCallback } = await import("./control/oauth");
      return handleOAuthCallback(request, control.db, control.identity);
    } catch {
      return unavailableResponse();
    }
  }

  if (url.pathname === "/auth/email/callback") {
    const control = services.control;
    if (!control?.guestEmail || !control.email) return unavailableResponse();
    try {
      const { consumeEmailCallback } = await import("./control/guests");
      return await consumeEmailCallback(request, control.db, { ...control.guestEmail, email: control.email });
    } catch (error) {
      console.error(JSON.stringify({ event: "email_callback_failed", error: error instanceof Error ? error.message : String(error) }));
      return unavailableResponse();
    }
  }

  if (url.pathname === "/api/auth/callback") {
    return Response.json({
      apiVersion: 1,
      error: {
        code: "endpoint_retired",
        message: "This OAuth callback has moved to /auth/github/callback.",
      },
    }, { status: 410, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  if (url.pathname === "/api" || url.pathname.startsWith(API_PREFIX)) {
    try {
      if (isPublicFeedbackPath(url.pathname)) {
        return services.feedback
          ? gatewayResponse(await services.feedback.fetch(request))
          : unavailableResponse();
      }
      if (isProviderIngressPath(url.pathname)) {
        return services.provider
          ? gatewayResponse(await services.provider.fetch(request))
          : unavailableResponse();
      }
      const publicConnectorPath = isPublicConnectorPath(url.pathname, request);
      if (publicConnectorPath) return gatewayResponse(await services.connector.fetch(request));

      const control = services.control;
      if (!control) return unavailableResponse();

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const { revokeBrowserSession } = await import("./control/auth");
        return revokeBrowserSession(request, control.db);
      }

      if (url.pathname === "/api/auth/email/request" && request.method === "POST") {
        if (!control.guestEmail || !control.email) return unavailableResponse();
        const { requestEmailLogin } = await import("./control/guests");
        return requestEmailLogin(request, control.db, { ...control.guestEmail, email: control.email });
      }

      if (url.pathname.startsWith("/api/auth/native/") || url.pathname.startsWith("/api/v1/auth/native/")) {
        const { handleNativeAuth } = await import("./control/native");
        return (await handleNativeAuth(request, control.db, control.identity))!;
      }

      if (url.pathname === "/api/auth/profile" || url.pathname === "/api/v1/auth/profile") {
        const { resolvePrincipalCredential } = await import("./control/auth");
        const principal = await resolvePrincipalCredential(request, control.db);
        if (!principal) {
          const authorization = request.headers.get("Authorization") ?? "";
          console.error(JSON.stringify({
            event: "profile_auth_rejected",
            path: url.pathname,
            status: 401,
            sessionCookiePresent: /(?:^|;\s*)__Host-nox_session=/.test(request.headers.get("Cookie") ?? ""),
            credentialKind: authorization.startsWith("Bearer nox_at_")
              ? "native"
              : authorization ? "unsupported" : "browser",
          }));
          return unavailableAuthentication();
        }
        const refreshRequested = url.searchParams.get("refresh") === "1";
        if (refreshRequested) {
          if (!principal.row.connection_id || !control.identity.refreshGitHubIdentity) {
            return apiError("github_connection_required", "Connect GitHub before refreshing organization access", 409);
          }
          try {
            const { refreshStoredGitHubMemberships } = await import("./control/oauth");
            await refreshStoredGitHubMemberships(control.db, control.identity, principal.row.principal_id, principal.row.connection_id);
          } catch (error) {
            console.error(JSON.stringify({
              event: "github_membership_refresh_failed",
              principalId: principal.row.principal_id,
              error: error instanceof Error ? error.message : String(error),
            }));
            return apiError("provider_unavailable", "GitHub organization access could not be refreshed", 502);
          }
        } else if (principal.row.connection_id && control.identity.refreshGitHubIdentity && services.background) {
          // Membership claims are persisted at sign-in and remain the access
          // boundary. Refresh them out of band so every application load does
          // not wait on GitHub's API before it can render.
          const { refreshStoredGitHubMemberships } = await import("./control/oauth");
          services.background(
            refreshStoredGitHubMemberships(control.db, control.identity, principal.row.principal_id, principal.row.connection_id)
              .catch((error) => {
                // A provider outage must not destroy cached access. A later
                // profile load retries the authoritative refresh.
                console.error(JSON.stringify({ event: "github_membership_refresh_failed", error: error instanceof Error ? error.message : String(error) }));
              }),
          );
        }
        const { profileResponse } = await import("./control/profile");
        return profileResponse(control.db, principal.row);
      }

      const { authenticate, membershipVerificationIsFresh } = await import("./control/auth");
      let authenticated = await authenticate(request, control.db);
      if ("response" in authenticated) {
        const authorization = request.headers.get("Authorization") ?? "";
        console.error(JSON.stringify({
          event: "gateway_auth_rejected",
          path: url.pathname,
          status: authenticated.response.status,
          code: await boundedErrorCode(authenticated.response),
          sessionCookiePresent: /(?:^|;\s*)__Host-nox_session=/.test(request.headers.get("Cookie") ?? ""),
          credentialKind: authorization.startsWith("Bearer nox_at_")
            ? "native"
            : authorization.startsWith("Bearer nox_sk_")
              ? "api_token"
              : authorization ? "unsupported" : "browser",
        }));
        return authenticated.response;
      }

      if (authenticated.context.accessLevel === "member"
          && !membershipVerificationIsFresh(authenticated.context)) {
        const connectionId = authenticated.context.connectionId;
        const principalId = authenticated.context.principalId;
        if (!connectionId || !principalId || !control.identity.refreshGitHubIdentity) {
          return staleMembershipResponse();
        }
        try {
          const { refreshStoredGitHubMemberships } = await import("./control/oauth");
          const refreshed = await refreshStoredGitHubMemberships(
            control.db,
            control.identity,
            principalId,
            connectionId,
          );
          if (!refreshed) return staleMembershipResponse();
        } catch (error) {
          console.error(JSON.stringify({
            event: "github_membership_verification_failed",
            principalId,
            error: error instanceof Error ? error.message : String(error),
          }));
          return staleMembershipResponse();
        }

        // Authorize again from the claims just persisted above. If GitHub no
        // longer reports this organization, authenticate now denies access or
        // applies an independently granted guest scope.
        authenticated = await authenticate(request, control.db);
        if ("response" in authenticated) return authenticated.response;
      }

      const { context: auth } = authenticated;
      const { handleMembershipControl, freshAdmin, sensitiveAdminMutation } = await import("./control/memberships");
      const membershipResponse = await handleMembershipControl(request, control.db, auth);
      if (membershipResponse) return membershipResponse;
      if (auth.isAdmin && sensitiveAdminMutation(request) && !freshAdmin(auth)) {
        return Response.json({ apiVersion: 1, error: { code: "membership_refresh_required", message: "Refresh your verified GitHub membership before changing organization settings" } }, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
      const { handleApiTokens } = await import("./control/api-tokens");
      const tokenResponse = await handleApiTokens(request, control.db, auth);
      if (tokenResponse) return tokenResponse;

      if (control.guestEmail && control.email) {
        const { handleGuestControl } = await import("./control/guests");
        const guestResponse = await handleGuestControl(request, control.db, { ...control.guestEmail, email: control.email }, auth);
        if (guestResponse) return guestResponse;
      }

      if (!control.assertionSecret) {
        return Response.json({
          apiVersion: 1,
          error: { code: "gateway_not_configured", message: "The internal authorization boundary is not configured." },
        }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      const { signedAssertionHeaders } = await import("./control/assertion");
      const headers = await signedAssertionHeaders(request, auth, control.assertionSecret);
      const relayed = new Request(request, { headers });
      const providerRequest = isAuthenticatedProviderPath(url.pathname);
      if (providerRequest && !services.provider) return unavailableResponse();
      const destination = providerRequest ? services.provider! : services.connector;
      const response = await destination.fetch(relayed);
      if (!response.ok) {
        const error = await boundedErrorCode(response);
        console.error(JSON.stringify({
          event: "connector_request_rejected",
          path: url.pathname,
          status: response.status,
          code: error,
          orgId: auth.orgId,
        }));
      }
      if (response.ok && auth.isAdmin && sensitiveAdminMutation(request)) {
        const { audit } = await import("./control/memberships");
        const auditWork = audit(control.db, auth, "organization.setting_changed", url.pathname, { method: request.method.toUpperCase() })
          .run()
          .catch((error) => console.error(JSON.stringify({ event: "admin_audit_failed", path: url.pathname, error: error instanceof Error ? error.message : String(error) })));
        if (services.background) services.background(auditWork);
        else await auditWork;
      }
      const { mirrorAndOverlayResponse } = await import("./control/mirror");
      return gatewayResponse(await mirrorAndOverlayResponse(request, response, control.db, auth, services.background));
    } catch (error) {
      console.error(JSON.stringify({
        message: "private connector call failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return unavailableResponse();
    }
  }

  if (isPublicFeedbackPath(url.pathname)) {
    return services.feedback
      ? gatewayResponse(await services.feedback.fetch(request))
      : unavailableResponse();
  }

  return services.assets.fetch(request);
}

async function privateBoundaryHealth(request: Request, services: PlatformServices): Promise<Response> {
  const control = services.control;
  if (!control?.assertionSecret) return unavailableResponse();
  const org = await control.db.prepare(
    "SELECT id, github_login FROM orgs WHERE suspended_at IS NULL ORDER BY id LIMIT 1",
  ).first<{ id: number; github_login: string }>();
  if (!org) return Response.json({ service: "noxhere", status: "degraded", dependency: "noxhere", code: "no_active_organization" }, { status: 503 });

  const target = new Request(new URL("/api/v1/me", request.url), {
    headers: { "X-Org": org.github_login },
  });
  const { signedAssertionHeaders } = await import("./control/assertion");
  const headers = await signedAssertionHeaders(target, {
    credentialType: "session",
    credentialId: "private-boundary-health",
    principalId: null,
    userLogin: "noxhere-health",
    userId: null,
    orgId: org.id,
    orgLogin: org.github_login,
    isAdmin: false,
    projectId: null,
    scopes: [],
    connectionId: null,
    accessLevel: "member",
    guestAccess: null,
  }, control.assertionSecret);
  const downstream = await services.connector.fetch(new Request(target, { headers }));
  const code = downstream.ok ? null : await boundedErrorCode(downstream);
  return Response.json({
    service: "noxhere",
    status: downstream.ok ? "ok" : "degraded",
    dependency: "noxhere",
    downstreamStatus: downstream.status,
    ...(code ? { code } : {}),
  }, { status: downstream.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

async function identityBoundaryHealth(services: PlatformServices): Promise<Response> {
  const control = services.control;
  if (!control?.identity.resolveGitHubIdentity) return unavailableResponse();
  const principal = await control.db.prepare(
    `SELECT github_login, github_connection_id AS connection_id
       FROM principals
      WHERE github_connection_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1`,
  ).first<{ github_login: string; connection_id: string }>();
  if (!principal) {
    return Response.json({
      service: "noxhere",
      status: "ok",
      dependency: "connections",
      mode: "not_configured",
    }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const identity = await control.identity.resolveGitHubIdentity(principal.connection_id);
    const healthy = Boolean(identity && identity.user.login.toLowerCase() === principal.github_login.toLowerCase());
    return Response.json({
      service: "noxhere",
      status: healthy ? "ok" : "degraded",
      dependency: "connections",
      ...(healthy ? {} : { code: "identity_connection_expired" }),
    }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "identity_boundary_health_failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ service: "noxhere", status: "degraded", dependency: "connections", code: "identity_service_unavailable" }, { status: 503 });
  }
}

async function boundedErrorCode(response: Response): Promise<string> {
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > 64 * 1024) return "response_too_large";
  try {
    const body = await response.clone().json<{ error?: { code?: unknown } }>();
    return typeof body.error?.code === "string" ? body.error.code : "unknown";
  } catch {
    return "unknown";
  }
}

function isApiTokenRequest(request: Request): boolean {
  return (request.headers.get("Authorization") ?? "").startsWith("Bearer nox_sk_");
}

function isPublicConnectorPath(pathname: string, request: Request): boolean {
  return pathname === "/api/health/live"
    || pathname === "/api/health/ready"
    || pathname.startsWith("/api/public/")
    || ((pathname === "/api/telemetry/public/v1/events"
      || pathname === "/api/v1/telemetry/public/events"
      || pathname === "/api/v1/growth/events"
      || pathname === "/api/v1/usage/events") && !isApiTokenRequest(request));
}

function isProviderIngressPath(pathname: string): boolean {
  return pathname === "/api/webhook"
    || pathname === "/api/postmark/webhook"
    || pathname === "/api/slack/oauth/callback"
    || pathname === "/api/slack/oauth/handoff"
    || pathname === "/api/slack/events"
    || pathname === "/api/slack/interactions";
}

function isAuthenticatedProviderPath(pathname: string): boolean {
  if (pathname === "/api/slack/test" || pathname === "/api/v1/slack/test") return false;
  return pathname.startsWith("/api/slack/")
    || pathname.startsWith("/api/v1/slack/")
    || /^\/api\/(?:v1\/)?integrations\/connections\/[^/]+\/start$/.test(pathname);
}

function isPublicFeedbackPath(pathname: string): boolean {
  return pathname.startsWith("/api/feedback/public/v1/")
    || pathname.startsWith("/widget/")
    || pathname.startsWith("/r2/")
    || pathname.startsWith("/responses/")
    || pathname === "/feedback.min.js"
    || pathname === "/feedback-core.min.js";
}

function unavailableAuthentication(): Response {
  return Response.json({
    apiVersion: 1,
    error: { code: "unauthorized", message: "Authentication required" },
  }, { status: 401, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

type RuntimeEnv = Env & {
  NOXHERE_INTERNAL_SECRET?: string;
  TELEMETRY_INGEST?: Fetcher;
  TELEMETRY_INGEST_KEY?: string;
  BUILD_SHA?: string;
  ENVIRONMENT?: "production" | "staging";
};

function serviceFetch(service: Fetcher): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return service.fetch(request);
  }) as typeof fetch;
}

function incidentRoute(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id")
    .replace(/\/[0-9a-f]{32,}(?=\/|$)/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .slice(0, 160);
}

function shouldReportGatewayFailure(pathname: string): boolean {
  return !pathname.startsWith("/__noxhere/health")
    && pathname !== "/api/health/live"
    && pathname !== "/api/health/ready"
    && pathname !== "/api/v1/telemetry/public/events"
    && pathname !== "/api/telemetry/public/v1/events";
}

function reportGatewayFailure(
  env: RuntimeEnv,
  request: Request,
  error: unknown,
  status: number,
  correlationId: string,
): Promise<unknown> {
  if (!env.TELEMETRY_INGEST || !env.TELEMETRY_INGEST_KEY) return Promise.resolve();
  const url = new URL(request.url);
  const route = incidentRoute(url.pathname);
  const client = createTelemetry({
    key: env.TELEMETRY_INGEST_KEY,
    environment: env.ENVIRONMENT ?? "production",
    release: env.BUILD_SHA,
    endpoint: "https://telemetry.internal/v1/events",
    fetch: serviceFetch(env.TELEMETRY_INGEST),
    maxRetries: 3,
  });
  const evidence = error ?? Object.assign(new Error(`Gateway returned HTTP ${status}`), {
    name: "GatewayResponseError",
    code: `HTTP_${status}`,
    status,
  });
  return client.error(evidence, {
    title: `NoxHere ${request.method.toUpperCase()} ${route} failed`,
    message: "The public NoxHere gateway could not complete a request.",
    component: "noxhere.gateway",
    fingerprint: `noxhere.gateway|${request.method.toUpperCase()}|${route}|${status}`,
    idempotencyKey: correlationId,
    url: `${url.origin}${url.pathname}`,
    fatal: false,
    unhandled: Boolean(error),
    attributes: {
      method: request.method.toUpperCase(),
      route,
      status,
      correlationId,
      cfRay: request.headers.get("CF-Ray") ?? "unavailable",
      notifyEveryOccurrence: true,
    },
  });
}

export default {
  async fetch(request, env, execution): Promise<Response> {
    const runtimeEnv: RuntimeEnv = env;
    const capabilities = env.NOXHERE_IDENTITY as typeof env.NOXHERE_IDENTITY
      & import("./control/oauth").IdentityService
      & import("./control/oauth").EmailService;
    const url = new URL(request.url);
    const correlationId = request.headers.get("CF-Ray") ?? crypto.randomUUID();
    try {
      const response = await handleRequest(request, {
        assets: env.ASSETS,
        connector: env.NOXHERE,
        provider: capabilities,
        feedback: env.FEEDBACK,
        control: {
          db: env.CONTROL_DB,
          identity: capabilities,
          email: capabilities,
          assertionSecret: runtimeEnv.NOXHERE_INTERNAL_SECRET,
          guestEmail: {
            PUBLIC_APP_ORIGIN: env.PUBLIC_APP_ORIGIN,
          },
        },
        background: (work) => execution.waitUntil(work),
      });
      if (response.status >= 500 && shouldReportGatewayFailure(url.pathname)) {
        execution.waitUntil(reportGatewayFailure(runtimeEnv, request, null, response.status, correlationId));
      }
      const headers = new Headers(response.headers);
      headers.set("X-NoxHere-Correlation-ID", correlationId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      if (shouldReportGatewayFailure(url.pathname)) {
        execution.waitUntil(reportGatewayFailure(runtimeEnv, request, error, 500, correlationId));
      }
      console.error(JSON.stringify({
        event: "gateway.unhandled_failure",
        correlationId,
        route: incidentRoute(url.pathname),
        error: error instanceof Error ? error.message : String(error),
      }));
      const response = unavailableResponse();
      response.headers.set("X-NoxHere-Correlation-ID", correlationId);
      return response;
    }
  },
} satisfies ExportedHandler<RuntimeEnv>;
