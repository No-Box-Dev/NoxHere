import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createNoxHere, NoxHereTransportError } from "./client.js";
import { operationDefinitions } from "./operations.generated.js";

describe("@noxhere/sdk", () => {
  it("maps every OpenAPI operation exactly once", () => {
    expect(operationDefinitions.length).toBeGreaterThan(100);
    expect(new Set(operationDefinitions.map((item) => item.id)).size).toBe(operationDefinitions.length);
    const client = createNoxHere({ fetch: vi.fn() as typeof fetch });
    expect(Object.keys(client.operations)).toHaveLength(operationDefinitions.length);
    expect(client.cue).toBe(client.incidents);
    expect(client.spot).toBe(client.feedback);
  });

  it("exposes exact generated operation inputs, outputs, and namespaces", () => {
    const client = createNoxHere({ fetch: vi.fn() as typeof fetch });
    expectTypeOf(client.activity.getIssue).parameter(0).toMatchTypeOf<{
      path: { repo: string; number: number };
    }>();
    expectTypeOf(client.activity.getIssue).returns.toMatchTypeOf<Promise<Record<string, unknown>>>();

    const compileTimeAssertions = () => {
      // @ts-expect-error Required OpenAPI path parameters cannot be omitted.
      void client.activity.getIssue();
      // @ts-expect-error OpenAPI path parameter names are exact.
      void client.activity.getIssue({ path: { repository: "owner/repo", number: 1 } });
      // @ts-expect-error Activity operations do not leak into the workspace namespace.
      void client.workspace.getIssue({ path: { repo: "owner/repo", number: 1 } });
      // @ts-expect-error Required OpenAPI request bodies cannot be omitted.
      void client.feedback.createNoxSpotSite();
    };
    void compileTimeAssertions;
  });

  it("encodes path/query input and applies unified auth headers", async () => {
    const request = vi.fn(async () => Response.json({ ok: true }));
    const client = createNoxHere({
      baseUrl: "https://example.test/base/",
      token: "nox_sk_test_secret",
      organization: "no-box-dev",
      projectId: "project-1",
      fetch: request as typeof fetch,
    });
    await client.activity.getIssue({ path: { repo: "owner/repo", number: 42 }, query: { include: ["body", "labels"] } });
    const [url, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(String(url)).toBe("https://example.test/api/v1/issues/owner%2Frepo/42?include=body&include=labels");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer nox_sk_test_secret");
    expect(new Headers(init?.headers).get("x-project-id")).toBe("project-1");
  });

  it("serializes JSON and returns structured API errors", async () => {
    const request = vi.fn(async () => Response.json(
      { error: { code: "permission_denied", message: "Access denied" } },
      { status: 403, headers: { "X-Request-ID": "request-1" } },
    ));
    const client = createNoxHere({ fetch: request as typeof fetch });
    await expect(client.request("createProject", { body: { name: "Demo" } })).rejects.toMatchObject({
      status: 403,
      operationId: "createProject",
      code: "permission_denied",
      message: "Access denied",
      requestId: "request-1",
      retryable: false,
    });
    const [, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("retries only operations classified as safe and honors Retry-After", async () => {
    const safeRequest = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(Response.json({ projects: [] }));
    const sleep = vi.fn(async () => {});
    const client = createNoxHere({ fetch: safeRequest as typeof fetch, sleep });
    await expect(client.workspace.listProjects()).resolves.toEqual({ projects: [] });
    expect(safeRequest).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);

    const unsafeRequest = vi.fn(async () => Response.json({ error: "busy" }, { status: 503 }));
    const unsafe = createNoxHere({ fetch: unsafeRequest as typeof fetch, sleep });
    await expect(unsafe.workspace.createProject({ body: { name: "Demo" } })).rejects.toMatchObject({ status: 503 });
    expect(unsafeRequest).toHaveBeenCalledTimes(1);
  });

  it("supports scoped clients, operation servers, SDK headers, and sanitized hooks", async () => {
    const request = vi.fn(async () => Response.json({ ok: true }));
    const observed: string[] = [];
    const client = createNoxHere({
      token: "nox_sk_secret",
      fetch: request as typeof fetch,
      onRequest: (event) => { observed.push(event.url); },
    }).withContext({ organization: "No-Box-Dev", projectId: "project-1" });
    await client.feedback.getPublicNoxSpotConfig({ path: { siteId: "site-1" } });
    const [url, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(String(url)).toBe("https://api.noxspot.dev/api/spots/public/v1/sites/site-1/config");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-org")).toBeNull();
    expect(headers.get("x-project-id")).toBeNull();
    expect(headers.get("x-noxhere-sdk")).toBe("typescript/0.2.0");

    await client.feedback.reopenResolvedNoxSpotReport({ path: { token: "secret-token" }, body: new FormData() });
    expect(observed.at(-1)).toContain("[redacted]");
    expect(observed.at(-1)).not.toContain("secret-token");
  });

  it("keeps operation-server requests on an explicitly configured base URL", async () => {
    const request = vi.fn(async () => Response.json({ ok: true }));
    const client = createNoxHere({
      baseUrl: "https://staging.example.test/root/",
      token: "nox_sk_staging",
      fetch: request as typeof fetch,
    });

    await client.feedback.getPublicNoxSpotConfig({ path: { siteId: "site-1" } });

    const [url, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(String(url)).toBe("https://staging.example.test/api/spots/public/v1/sites/site-1/config");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("rejects bearer credentials over non-loopback HTTP", async () => {
    const request = vi.fn(async () => Response.json({ ok: true }));
    const insecure = createNoxHere({ baseUrl: "http://example.test", token: "secret", fetch: request as typeof fetch });
    await expect(insecure.workspace.listProjects()).rejects.toThrow(/require HTTPS/);
    expect(request).not.toHaveBeenCalled();

    const loopback = createNoxHere({ baseUrl: "http://127.0.0.1:8787", token: "secret", fetch: request as typeof fetch });
    await expect(loopback.workspace.listProjects()).resolves.toEqual({ ok: true });
  });

  it("bounds requests with a timeout without retrying unsafe work", async () => {
    const request = vi.fn((_url: URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const client = createNoxHere({ fetch: request as typeof fetch, timeoutMs: 5, maxRetries: 0 });
    await expect(client.workspace.createProject({ body: { name: "Demo" } })).rejects.toBeInstanceOf(NoxHereTransportError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("resolves dynamic credentials, browser CSRF, and authentication callbacks per request", async () => {
    vi.stubGlobal("document", { cookie: "other=value; nox_csrf=csrf%20token" });
    const token = vi.fn(async () => "nox_at_dynamic");
    const onAuthenticationRequired = vi.fn();
    const request = vi.fn(async () => Response.json({ error: "expired" }, { status: 401 }));
    const client = createNoxHere({ token, fetch: request as typeof fetch, onAuthenticationRequired });
    await expect(client.workspace.createProject({ body: { name: "Demo" } })).rejects.toMatchObject({ status: 401 });
    const headers = new Headers((request.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Bearer nox_at_dynamic");
    expect(headers.get("x-csrf-token")).toBe("csrf token");
    expect(token).toHaveBeenCalledTimes(1);
    expect(onAuthenticationRequired).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
