import { describe, expect, it, vi } from "vitest";
import { handleRequest, type PlatformServices } from "../index";
import { requiredScope } from "../control/auth";
// @ts-expect-error The existing compatibility authorization module has no TypeScript declaration.
import { projectScopedApiTokenPathSupported } from "../../../../functions/lib/api-auth.js";
import contract from "./noxhere-contract.json";
import { PROTOCOL_VERSION } from "./mcp";

const token = "nox_sk_test_mcp_integration_fixture";
function request(method: string, params: Record<string, unknown> = {}) {
  return new Request("https://app.noxhere.com/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": method, ...(method === "tools/call" ? { "Mcp-Name": String(params.name) } : {}),
      Cookie: "ignored=1", "X-Org": "untrusted-org", "X-Project-ID": "untrusted-project",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {
      ...params, _meta: { "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION, "io.modelcontextprotocol/clientCapabilities": {} },
    } }),
  });
}
function bindings(options: { scopes?: string[]; disabled?: boolean; downstreamStatus?: number; revoked?: boolean } = {}) {
  const db = {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes("FROM api_tokens")) return options.revoked ? null : {
            id: "fixture-token", org_id: 7, project_id: "project-a", org_login: "acme",
            project_enabled: options.disabled ? 0 : 1, environment: "test",
            scopes_json: JSON.stringify(options.scopes ?? ["services:read", "activity:read", "planning:read", "feedback:read", "issues:read"]),
          };
          return null;
        },
        async run() { return { success: true }; },
      };
      return statement;
    },
  } as unknown as D1Database;
  const connector = { fetch: vi.fn(async (read: Request) => {
    if (options.downstreamStatus) return new Response(null, { status: options.downstreamStatus });
    return Response.json({ items: [{ title: "Example" }], credentialForwarded: read.headers.has("Authorization") });
  }) };
  const services: PlatformServices = {
    assets: { fetch: vi.fn(async () => new Response("SPA must not handle MCP")) }, connector,
    control: { db, assertionSecret: "fixture-signing-secret", identity: {
      exchangeGitHubOAuth: vi.fn(), startGitHubDeviceAuth: vi.fn(), pollGitHubDeviceAuth: vi.fn(),
    } },
  };
  return services;
}

describe("native MCP gateway boundary", () => {
  it("runs before SPA handling", async () => {
    const services = bindings();
    const response = await handleRequest(request("tools/list"), services);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-NoxHere-Gateway")).toBe("1");
    expect((await response.json() as { result: { tools: unknown[] } }).result.tools).toHaveLength(11);
    expect(services.assets.fetch).not.toHaveBeenCalled();
    expect(services.connector.fetch).not.toHaveBeenCalled();
  });

  it("re-enters native authorization and forwards only a signed project assertion", async () => {
    const services = bindings();
    const response = await handleRequest(request("tools/call", { name: "work_list_features" }), services);
    expect(response.status).toBe(200);
    const data = await response.json() as { result: { isError: boolean } };
    expect(data.result.isError).toBe(false);
    const read = vi.mocked(services.connector.fetch).mock.calls[0][0];
    expect(new URL(read.url).pathname).toBe("/api/v1/features");
    expect(read.method).toBe("GET");
    expect(read.headers.get("Authorization")).toBeNull();
    expect(read.headers.get("Cookie")).toBeNull();
    const encoded = read.headers.get("X-NoxHere-Internal-Assertion")!;
    const assertion = JSON.parse(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")));
    expect(assertion.auth).toMatchObject({ credentialType: "api_token", orgLogin: "acme", projectId: "project-a" });
    expect(JSON.stringify(assertion)).not.toContain("untrusted");
    expect(read.headers.get("X-NoxHere-Internal-Signature")).toBeTruthy();
  });

  it("does not bypass downstream tenant or suspension denials", async () => {
    for (const downstreamStatus of [403, 404]) {
      const response = await handleRequest(request("tools/call", { name: "spots_get_report", arguments: { reportId: "foreign-report" } }), bindings({ downstreamStatus }));
      expect(await response.json()).toMatchObject({ result: { isError: true, structuredContent: { error: { code: `noxhere_http_${downstreamStatus}` } } } });
    }
  });

  it("uses native token lifecycle and scope failures before connector reads", async () => {
    for (const options of [{ disabled: true }, { revoked: true }, { scopes: ["planning:read"] }]) {
      const services = bindings(options);
      const response = await handleRequest(request("tools/list"), services);
      expect([401, 403]).toContain(response.status);
      expect(services.connector.fetch).not.toHaveBeenCalled();
    }
  });

  it("fails closed when gateway control is missing", async () => {
    const services = bindings();
    delete services.control;
    expect((await handleRequest(request("tools/list"), services)).status).toBe(503);
    expect(services.assets.fetch).not.toHaveBeenCalled();
  });

  it("every mapped read is admitted by existing gateway and connector authorization", () => {
    for (const op of contract.operations) {
      const path = op.path.replaceAll("{projectId}", "project-a").replaceAll("{reportId}", "report-a")
        .replaceAll("{specId}", "1").replaceAll("{repo}", "repository").replaceAll("{number}", "1");
      expect(requiredScope(path, "GET"), op.name).toBe(op.scope);
      expect(projectScopedApiTokenPathSupported(path, "GET"), op.name).toBe(true);
    }
  });

  it("documents real authorization gaps without widening the existing policy", () => {
    expect(projectScopedApiTokenPathSupported("/api/v1/projects/project-a/growth/dashboard", "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/v1/projects/project-a/usage/dashboard", "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/v1/projects/project-a/incidents/inc_" + "a".repeat(32), "GET")).toBe(false);
    expect(projectScopedApiTokenPathSupported("/api/v1/feedback/project-overview", "GET")).toBe(false);
    expect(requiredScope("/api/v1/projects", "POST")).toBeNull();
    expect(contract.operations.some((op) => op.domain === "Admin" || op.domain === "Growth" || op.domain === "Usage")).toBe(false);
  });
});
