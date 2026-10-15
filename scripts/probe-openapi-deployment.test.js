import { describe, expect, it } from "vitest";
import {
  classifyProbe,
  operationsFromSpec,
  probeDeployment,
  probePath,
  requiresAuthentication,
} from "./probe-openapi-deployment.mjs";

const secured = [{ nativeSession: [], organization: [] }];
const publicAccess = [];

function response(status, contentType = "application/json") {
  return new Response(null, { status, headers: { "Content-Type": contentType } });
}

describe("deployment OpenAPI probe", () => {
  it("extracts operations and inherits root security", () => {
    const spec = {
      security: secured,
      paths: {
        "/api/v1/items/{id}": {
          parameters: [],
          get: { operationId: "getItem" },
          post: { operationId: "createItem", security: [] },
        },
      },
    };
    expect(operationsFromSpec(spec)).toEqual([
      { method: "GET", path: "/api/v1/items/{id}", operationId: "getItem", security: secured },
      { method: "POST", path: "/api/v1/items/{id}", operationId: "createItem", security: [] },
    ]);
    expect(probePath("/api/v1/items/{id}")).toBe("/api/v1/items/__noxhere_probe__");
  });

  it("recognizes authenticated and explicitly public alternatives", () => {
    expect(requiresAuthentication(secured)).toBe(true);
    expect(requiresAuthentication(publicAccess)).toBe(false);
    expect(requiresAuthentication([{ nativeSession: [] }, {}])).toBe(false);
  });

  it("requires the canonical anonymous rejection for protected operations", () => {
    const operation = { method: "GET", operationId: "getItem", security: secured };
    expect(classifyProbe(
      operation,
      response(401),
      JSON.stringify({ apiVersion: 1, error: { code: "unauthorized" } }),
    )).toEqual([]);
    expect(classifyProbe(operation, response(200), "{}")).toContain(
      "secured operation returned 200 instead of 401",
    );
  });

  it("rejects anonymous writes and server failures", () => {
    const operation = { method: "POST", operationId: "createItem", security: publicAccess };
    expect(classifyProbe(operation, response(201), "{}")).toContain(
      "anonymous write unexpectedly succeeded",
    );
    expect(classifyProbe(operation, response(503), "{}")).toContain(
      "returned server error 503",
    );
  });

  it("allows only the two intentional public response contracts", () => {
    expect(classifyProbe(
      { method: "POST", operationId: "revokeNativeSession", security: publicAccess },
      response(200),
      JSON.stringify({ revoked: false }),
    )).toEqual([]);
    expect(classifyProbe(
      { method: "POST", operationId: "reopenResolvedFeedbackReport", security: publicAccess },
      response(404, "text/html; charset=utf-8"),
      "<p>This response link has expired or has already been used.</p>",
    )).toEqual([]);
    expect(classifyProbe(
      { method: "GET", operationId: "getItem", security: publicAccess },
      response(404, "text/html"),
      "<p>Not found</p>",
    )).toContain("API operation returned HTML");
  });

  it("waits for the production contract cache to converge", async () => {
    const localSpec = { openapi: "3.1.0", paths: {} };
    const responses = [
      { openapi: "3.1.0", paths: { "/stale": {} } },
      localSpec,
    ];
    const requested = [];
    const result = await probeDeployment({
      origin: "https://app.example.test",
      localSpec,
      fetchImpl: async (url) => {
        requested.push(String(url));
        return Response.json(responses.shift());
      },
      contractRetryMs: 0,
      sleepImpl: async () => {},
    });

    expect(result.contractMatches).toBe(true);
    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain("nox_release_probe=");
  });
});
