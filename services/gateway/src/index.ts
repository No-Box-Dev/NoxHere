type BoundService = {
  fetch(request: Request): Promise<Response>;
};

export interface PlatformServices {
  assets: BoundService;
  connector: BoundService;
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

function gatewayResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-NoxHere-Gateway", "1");
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
        message: "The NoxConnect integration service is temporarily unavailable.",
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
      const publicConnectorPath = isPublicConnectorPath(url.pathname);
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
        if (principal.row.connection_id && control.identity.refreshGitHubIdentity && services.background) {
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

      const { authenticate } = await import("./control/auth");
      const authenticated = await authenticate(request, control.db);
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

      const { context: auth } = authenticated;
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
      const response = await services.connector.fetch(relayed);
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
      const { mirrorAndOverlayResponse } = await import("./control/mirror");
      return gatewayResponse(await mirrorAndOverlayResponse(request, response, control.db, auth));
    } catch (error) {
      console.error(JSON.stringify({
        message: "private connector call failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return unavailableResponse();
    }
  }

  return services.assets.fetch(request);
}

async function privateBoundaryHealth(request: Request, services: PlatformServices): Promise<Response> {
  const control = services.control;
  if (!control?.assertionSecret) return unavailableResponse();
  const org = await control.db.prepare(
    "SELECT id, github_login FROM orgs WHERE suspended_at IS NULL ORDER BY id LIMIT 1",
  ).first<{ id: number; github_login: string }>();
  if (!org) return Response.json({ service: "noxhere", status: "degraded", dependency: "noxconnect", code: "no_active_organization" }, { status: 503 });

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
    dependency: "noxconnect",
    downstreamStatus: downstream.status,
    ...(code ? { code } : {}),
  }, { status: downstream.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
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

function isPublicConnectorPath(pathname: string): boolean {
  return pathname === "/api/health/live"
    || pathname === "/api/health/ready"
    || pathname === "/api/webhook"
    || pathname === "/api/postmark/webhook"
    || pathname.startsWith("/api/spots/public/v1/resolution/")
    || pathname.startsWith("/api/spots/public/v1/resolution-responses/")
    || pathname === "/api/slack/oauth/callback"
    || pathname === "/api/slack/oauth/handoff"
    || pathname === "/api/slack/events"
    || pathname === "/api/slack/interactions"
    || pathname.startsWith("/api/public/")
    || pathname === "/api/cues/public/v1/events"
    || pathname === "/api/v1/cues/public/events";
}

function unavailableAuthentication(): Response {
  return Response.json({
    apiVersion: 1,
    error: { code: "unauthorized", message: "Authentication required" },
  }, { status: 401, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

type RuntimeEnv = Env & {
  NOXHERE_INTERNAL_SECRET?: string;
};

export default {
  async fetch(request, env, execution): Promise<Response> {
    const runtimeEnv: RuntimeEnv = env;
    const capabilities = env.NOXCONNECT_IDENTITY as typeof env.NOXCONNECT_IDENTITY
      & import("./control/oauth").IdentityService
      & import("./control/oauth").EmailService;
    return handleRequest(request, {
      assets: env.ASSETS,
      connector: env.NOXCONNECT,
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
  },
} satisfies ExportedHandler<RuntimeEnv>;
