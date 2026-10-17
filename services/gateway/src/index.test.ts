import { describe, expect, it, vi } from "vitest";
import { handleRequest, type PlatformServices } from "./index";

function controlDb(options: {
  apiToken?: Record<string, unknown>;
  nativeSession?: Record<string, unknown>;
  membershipVerifiedAt?: string;
} = {}): D1Database {
  return {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes("FROM native_sessions")) return options.nativeSession ?? null;
          if (sql.includes("FROM browser_sessions")) return {
            credential_id: "session-hash",
            principal_id: "github:42",
            github_user_id: 42,
            github_login: "octocat",
            connection_id: "noxic_connection",
            csrf_hash: "csrf-hash",
          };
          if (sql.includes("FROM org_memberships")) return {
            org_id: 7,
            github_login: "acme",
            role: "admin",
            managed_role: null,
            verified_at: options.membershipVerifiedAt ?? new Date().toISOString(),
            suspended_at: null,
          };
          if (sql.includes("FROM api_tokens")) return options.apiToken ?? null;
          return null;
        },
        async run() { return { success: true }; },
      };
      return statement;
    },
  } as unknown as D1Database;
}

function controlledServices(
  connector: PlatformServices["connector"],
  db = controlDb(),
  provider?: PlatformServices["provider"],
): PlatformServices {
  return services({
    connector,
    provider,
    control: {
      db,
      identity: {
        exchangeGitHubOAuth: vi.fn(),
        startGitHubDeviceAuth: vi.fn(),
        pollGitHubDeviceAuth: vi.fn(),
      },
      assertionSecret: "integration-secret",
    },
  });
}

function services(overrides: Partial<PlatformServices> = {}): PlatformServices {
  return {
    assets: { fetch: vi.fn(async () => new Response("asset")) },
    connector: { fetch: vi.fn(async () => Response.json({ ok: true })) },
    ...overrides,
  };
}

describe("NoxHere gateway", () => {
  it("serves its own bounded health response", async () => {
    const bindings = services();
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health"),
      bindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: "noxhere",
      plane: "public-platform",
      status: "ok",
    });
    expect(bindings.connector.fetch).not.toHaveBeenCalled();
  });

  it("probes the signed private connector boundary without exposing connector data", async () => {
    const db = {
      prepare() {
        return { async first() { return { id: 7, github_login: "acme" }; } };
      },
    } as unknown as D1Database;
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      secretData: "must-not-leak",
      signed: Boolean(request.headers.get("X-NoxHere-Internal-Signature")),
    })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/private-boundary"),
      controlledServices(connector, db),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "noxhere",
      status: "ok",
      dependency: "noxhere",
      downstreamStatus: 200,
    });
    expect(connector.fetch).toHaveBeenCalledOnce();
  });

  it("reports the connector error code when the private assertion is rejected", async () => {
    const db = {
      prepare() {
        return { async first() { return { id: 7, github_login: "acme" }; } };
      },
    } as unknown as D1Database;
    const connector = { fetch: vi.fn(async () => Response.json({
      error: { code: "invalid_internal_assertion" },
    }, { status: 401 })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/private-boundary"),
      controlledServices(connector, db),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      downstreamStatus: 401,
      code: "invalid_internal_assertion",
    });
  });

  it("probes a real connection-backed identity boundary", async () => {
    const db = {
      prepare() {
        return { async first() { return { github_login: "octocat", connection_id: "noxic_connection" }; } };
      },
    } as unknown as D1Database;
    const identity = {
      exchangeGitHubOAuth: vi.fn(),
      startGitHubDeviceAuth: vi.fn(),
      pollGitHubDeviceAuth: vi.fn(),
      resolveGitHubIdentity: vi.fn(async () => ({ token: "private", user: { id: 42, login: "octocat" } })),
    };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/identity-boundary"),
      services({ control: { db, identity, assertionSecret: "integration-secret" } }),
    );

    expect(response.status).toBe(200);
    expect(identity.resolveGitHubIdentity).toHaveBeenCalledWith("noxic_connection");
    await expect(response.json()).resolves.toEqual({ service: "noxhere", status: "ok", dependency: "connections" });
  });

  it("keeps an empty environment ready until its first identity connection exists", async () => {
    const db = {
      prepare() {
        return { async first() { return null; } };
      },
    } as unknown as D1Database;
    const identity = {
      exchangeGitHubOAuth: vi.fn(),
      startGitHubDeviceAuth: vi.fn(),
      pollGitHubDeviceAuth: vi.fn(),
      resolveGitHubIdentity: vi.fn(),
    };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/identity-boundary"),
      services({ control: { db, identity, assertionSecret: "integration-secret" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(identity.resolveGitHubIdentity).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      service: "noxhere",
      status: "ok",
      dependency: "connections",
      mode: "not_configured",
    });
  });

  it("fails identity readiness when the Connections capability is unavailable", async () => {
    const db = {
      prepare() {
        return { async first() { return { github_login: "octocat", connection_id: "noxic_connection" }; } };
      },
    } as unknown as D1Database;
    const identity = {
      exchangeGitHubOAuth: vi.fn(),
      startGitHubDeviceAuth: vi.fn(),
      pollGitHubDeviceAuth: vi.fn(),
      resolveGitHubIdentity: vi.fn(async () => { throw new Error("rpc unavailable"); }),
    };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/identity-boundary"),
      services({ control: { db, identity, assertionSecret: "integration-secret" } }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "degraded", code: "identity_service_unavailable" });
  });

  it("relays public readiness only through the private connector binding", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ status: "ok" }, { status: 200 })) };
    const bindings = services({ connector });
    const request = new Request("https://app.noxhere.com/api/health/ready");

    const response = await handleRequest(request, bindings);

    expect(connector.fetch).toHaveBeenCalledWith(request);
    expect(response.headers.get("X-NoxHere-Gateway")).toBe("1");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("relays Postmark feedback unchanged without requiring a user session", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ accepted: true })) };
    const provider = { fetch: vi.fn(async () => Response.json({ accepted: true })) };
    const bindings = services({ connector, provider });
    const request = new Request("https://app.noxhere.com/api/postmark/webhook", {
      method: "POST",
      headers: { Authorization: "Basic provider-credential" },
      body: "{}",
    });

    const response = await handleRequest(request, bindings);

    expect(provider.fetch).toHaveBeenCalledWith(request);
    expect(connector.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-NoxHere-Gateway")).toBe("1");
  });

  it("probes provider ingress through Connections without exposing secrets", async () => {
    const provider = { fetch: vi.fn(async (request: Request) => Response.json({
      status: "ok",
      path: new URL(request.url).pathname,
    }, { headers: { "Cache-Control": "no-store" } })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/__noxhere/health/provider-ingress?release=123"),
      services({ provider }),
    );

    expect(provider.fetch).toHaveBeenCalledOnce();
    const relayed = provider.fetch.mock.calls[0][0];
    expect(new URL(relayed.url).pathname).toBe("/__noxhere/provider-ingress/ready");
    expect(new URL(relayed.url).searchParams.get("release")).toBe("123");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-NoxHere-Gateway")).toBe("1");
  });

  it("sends authenticated Slack operations to Connections with a signed assertion", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ wrong: true })) };
    const provider = { fetch: vi.fn(async (request: Request) => Response.json({
      configured: Boolean(request.headers.get("X-NoxHere-Internal-Assertion")),
    })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/slack/status", {
        headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme" },
      }),
      controlledServices(connector, controlDb(), provider),
    );

    expect(response.status).toBe(200);
    expect(provider.fetch).toHaveBeenCalledOnce();
    expect(connector.fetch).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Link")).toContain("/openapi.json");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ configured: true });
  });

  it("relays reporter resolution links without requiring a user session", async () => {
    const connector = { fetch: vi.fn(async () => new Response("private connector")) };
    const feedback = { fetch: vi.fn(async () => new Response("resolution form")) };
    const bindings = services({ connector, feedback });
    const request = new Request("https://app.noxhere.com/api/feedback/public/v1/resolution/token_123");

    const response = await handleRequest(request, bindings);

    expect(feedback.fetch).toHaveBeenCalledWith(request);
    expect(connector.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("resolution form");
  });

  it("serves feedback widget JavaScript through the public Feedback binding", async () => {
    const assets = { fetch: vi.fn(async () => new Response("<!doctype html>")) };
    const connector = { fetch: vi.fn(async () => new Response("private connector")) };
    const feedback = { fetch: vi.fn(async () => new Response("Feedback.init({});", {
      headers: { "Content-Type": "application/javascript" },
    })) };
    const bindings = services({ assets, connector, feedback });
    const request = new Request("https://app.noxhere.com/widget/site-1.js");

    const response = await handleRequest(request, bindings);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    await expect(response.text()).resolves.toBe("Feedback.init({});");
    expect(feedback.fetch).toHaveBeenCalledWith(request);
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("returns the standard unavailable envelope when the binding fails", async () => {
    const bindings = services({
      connector: { fetch: vi.fn(async () => { throw new Error("binding unavailable"); }) },
    });

    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/services"),
      bindings,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 1,
      error: { code: "service_unavailable" },
    });
  });

  it("serves non-API requests from the static asset binding", async () => {
    const assets = { fetch: vi.fn(async () => new Response("portal")) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/developers"),
      services({ assets }),
    );

    expect(assets.fetch).toHaveBeenCalledOnce();
    await expect(response.text()).resolves.toBe("portal");
  });

  it("owns the canonical GitHub callback without invoking the compatibility connector", async () => {
    const connector = { fetch: vi.fn(async () => new Response(null, { status: 500 })) };
    const request = new Request("https://app.noxhere.com/auth/github/callback?code=one");
    const response = await handleRequest(request, controlledServices(connector));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "oauth_state_mismatch" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("creates the NoxHere browser session through the private identity binding", async () => {
    const writes: Array<{ sql: string; binds: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          binds: [] as unknown[],
          bind(...binds: unknown[]) { statement.binds = binds; return statement; },
          async first() { return null; },
          async run() { writes.push({ sql, binds: statement.binds }); return { success: true }; },
        };
        return statement;
      },
      async batch(statements: D1PreparedStatement[]) {
        writes.push(...statements.map(() => ({ sql: "batch", binds: [] })));
        return statements.map(() => ({ success: true }));
      },
    } as unknown as D1Database;
    const identity = {
      exchangeGitHubOAuth: vi.fn(async () => ({
        version: 1 as const,
        connectionId: "noxic_connection",
        user: { id: 42, login: "octocat", avatarUrl: null },
        organizations: [{ id: 7, login: "acme", role: "admin" as const }],
      })),
      startGitHubDeviceAuth: vi.fn(),
      pollGitHubDeviceAuth: vi.fn(),
    };
    const connector = { fetch: vi.fn(async () => new Response(null, { status: 500 })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/auth/github/callback?code=one&state=expected", {
        headers: { Cookie: "ut_oauth_state=expected" },
      }),
      services({ connector, control: { db, identity } }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://app.noxhere.com/?login=ok");
    expect(response.headers.get("Set-Cookie")).toContain("__Host-nox_session=");
    expect(identity.exchangeGitHubOAuth).toHaveBeenCalledWith({
      code: "one",
      redirectUri: "https://app.noxhere.com/auth/github/callback",
    });
    expect(writes.some((write) => write.sql.includes("INSERT INTO browser_sessions"))).toBe(true);
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("retires the non-canonical API callback without invoking NoxHere", async () => {
    const connector = { fetch: vi.fn(async () => new Response(null, { status: 500 })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/auth/callback?code=one"),
      controlledServices(connector),
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "endpoint_retired" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("relays a project-aware connector conflict", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({
      apiVersion: 1,
      error: { code: "revision_conflict", message: "The resource changed" },
    }, { status: 409 })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/activity", {
        headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme" },
      }),
      controlledServices(connector),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_conflict" },
    });
    expect(connector.fetch).toHaveBeenCalledOnce();
  });

  it("fails closed when cached organization membership is stale and cannot be verified", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ private: true })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/activity", {
        headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme" },
      }),
      controlledServices(connector, controlDb({ membershipVerifiedAt: "2020-01-01T00:00:00Z" })),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "membership_verification_unavailable" },
    });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("passes only a short-lived signed identity assertion to NoxHere", async () => {
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
      signature: request.headers.get("X-NoxHere-Internal-Signature"),
    })) };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/activity?limit=5", {
        headers: {
          Cookie: "__Host-nox_session=opaque",
          "X-Org": "acme",
          "X-NoxHere-Internal-Assertion": "attacker-controlled",
        },
      }),
      controlledServices(connector),
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { assertion: string; signature: string };
    expect(body.signature).not.toBe("");
    const encoded = body.assertion.replaceAll("-", "+").replaceAll("_", "/");
    const assertion = JSON.parse(atob(encoded)) as Record<string, unknown>;
    expect(assertion).toMatchObject({
      issuer: "noxhere",
      audience: "noxhere",
      method: "GET",
      path: "/api/v1/activity?limit=5",
      auth: { userLogin: "octocat", orgLogin: "acme", connectionId: "noxic_connection" },
    });
    expect(JSON.stringify(assertion)).not.toContain("providerToken");
    expect(JSON.stringify(assertion)).not.toContain("githubToken");
  });

  it("keeps browser organization requests organization-wide when project context is omitted", async () => {
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      project: request.headers.get("X-Project-ID"),
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
    })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/activity", {
      headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme" },
    }), controlledServices(connector));
    const body = await response.json() as { project: string | null; assertion: string };
    const assertion = JSON.parse(atob(body.assertion.replaceAll("-", "+").replaceAll("_", "/"))) as { auth: { projectId: string | null } };
    expect(body.project).toBeNull();
    expect(assertion.auth.projectId).toBeNull();
  });

  it("preserves optional browser project context for connector validation", async () => {
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      project: request.headers.get("X-Project-ID"),
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
    })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/activity", {
      headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme", "X-Project-ID": "project-a" },
    }), controlledServices(connector));
    const body = await response.json() as { project: string; assertion: string };
    const assertion = JSON.parse(atob(body.assertion.replaceAll("-", "+").replaceAll("_", "/"))) as { auth: { projectId: string | null } };
    expect(body.project).toBe("project-a");
    expect(assertion.auth.projectId).toBe("project-a");
  });

  it("accepts a native session for an organization-wide request", async () => {
    const nativeSession = {
      credential_id: "native-session", principal_id: "github:42", github_user_id: 42,
      github_login: "octocat", connection_id: "noxic_connection",
    };
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      authorization: request.headers.get("Authorization"),
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
    })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/activity", {
      headers: { Authorization: "Bearer nox_at_example", "X-Org": "acme" },
    }), controlledServices(connector, controlDb({ nativeSession })));
    const body = await response.json() as { authorization: string | null; assertion: string };
    const assertion = JSON.parse(atob(body.assertion.replaceAll("-", "+").replaceAll("_", "/"))) as { auth: { credentialType: string; projectId: string | null } };
    expect(body.authorization).toBeNull();
    expect(assertion.auth).toMatchObject({ credentialType: "native_session", projectId: null });
  });

  it("accepts a correctly scoped automation token and forwards only its signed project", async () => {
    const apiToken = {
      id: "noxkey_1", org_id: 7, project_id: "project-a",
      scopes_json: JSON.stringify(["activity:read"]), org_login: "acme", project_enabled: 1,
    };
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      authorization: request.headers.get("Authorization"),
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
    })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/activity", {
      headers: { Authorization: "Bearer nox_sk_live_example", "X-Project-ID": "project-a" },
    }), controlledServices(connector, controlDb({ apiToken })));
    const body = await response.json() as { authorization: string | null; assertion: string };
    const assertion = JSON.parse(atob(body.assertion.replaceAll("-", "+").replaceAll("_", "/"))) as { auth: { credentialType: string; projectId: string } };
    expect(body.authorization).toBeNull();
    expect(assertion.auth).toMatchObject({ credentialType: "api_token", projectId: "project-a" });
  });

  it("authenticates a scoped server ingestion key while keeping browser ingestion public", async () => {
    const apiToken = {
      id: "noxkey_ingest", org_id: 7, project_id: "project-a", environment: "production",
      scopes_json: JSON.stringify(["telemetry:ingest"]), org_login: "acme", project_enabled: 1,
    };
    const connector = { fetch: vi.fn(async (request: Request) => Response.json({
      authorization: request.headers.get("Authorization"),
      assertion: request.headers.get("X-NoxHere-Internal-Assertion"),
    }, { status: 202 })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/telemetry/public/events", {
      method: "POST",
      headers: { Authorization: "Bearer nox_sk_live_example", "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user.active", userId: "h1_primary_example" }),
    }), controlledServices(connector, controlDb({ apiToken })));
    expect(response.status).toBe(202);
    const body = await response.json() as { authorization: string | null; assertion: string };
    const assertion = JSON.parse(atob(body.assertion.replaceAll("-", "+").replaceAll("_", "/"))) as {
      auth: { projectId: string; tokenEnvironment: string; scopes: string[] };
    };
    expect(body.authorization).toBeNull();
    expect(assertion.auth).toMatchObject({
      projectId: "project-a",
      tokenEnvironment: "production",
      scopes: ["telemetry:ingest"],
    });
  });

  it("rejects raw GitHub bearer credentials before invoking the connector", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ ok: true })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/activity", {
      headers: { Authorization: "Bearer github_pat_example", "X-Org": "acme" },
    }), controlledServices(connector));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unsupported_credential" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("requires CSRF proof for browser writes", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ ok: true })) };
    const response = await handleRequest(new Request("https://app.noxhere.com/api/v1/sync", {
      method: "POST",
      headers: { Cookie: "__Host-nox_session=opaque", "X-Org": "acme" },
    }), controlledServices(connector));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "csrf_failed" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("conceals other projects from project-scoped API tokens", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ ok: true })) };
    const tokenRow = {
      id: "noxkey_1",
      org_id: 7,
      project_id: "project-a",
      scopes_json: JSON.stringify(["activity:read"]),
      org_login: "acme",
      project_enabled: 1,
    };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/activity?project=project-b", {
        headers: { Authorization: "Bearer nox_sk_live_example" },
      }),
      controlledServices(connector, controlDb({ apiToken: tokenRow })),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "resource_not_found" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });

  it("does not leak an invalid NoxHere API token into the connector", async () => {
    const connector = { fetch: vi.fn(async () => Response.json({ legacy: true })) };
    const tokenRow = {
      id: "noxkey_1",
      org_id: 7,
      project_id: "project-a",
      scopes_json: JSON.stringify(["activity:read"]),
      org_login: "acme",
      project_enabled: 1,
    };
    const response = await handleRequest(
      new Request("https://app.noxhere.com/api/v1/activity?project=project-b", {
        headers: { Authorization: "Bearer nox_sk_test_example" },
      }),
      controlledServices(connector, controlDb({ apiToken: tokenRow })),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "resource_not_found" } });
    expect(connector.fetch).not.toHaveBeenCalled();
  });
});
