import { test } from "vitest";
import assert from "node:assert/strict";
import { handleMcp, PROTOCOL_VERSION, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES } from "./mcp.ts";
import contract from "./noxhere-contract.json" with { type: "json" };

const TOKEN = "nox_sk_test_fixture_only_not_a_secret";
const META = {
  "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": { name: "noxhere-unit-test", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const context = {
  credentialType: "api_token", projectId: "playnist-project-fixture", orgLogin: "example-org",
  scopes: ["services:read", "activity:read", "planning:read", "feedback:read"],
};
function rpc(method = "server/discover", params = {}, changes = {}) {
  const headers = new Headers({
    Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json",
    Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": method,
  });
  if (method === "tools/call") headers.set("Mcp-Name", params.name);
  for (const [key, value] of Object.entries(changes.headers ?? {})) {
    if (value === null) headers.delete(key); else headers.set(key, value);
  }
  return new Request(changes.url ?? "https://app.noxhere.com/mcp", {
    method: changes.method ?? "POST", headers,
    ...(changes.method === "GET" ? {} : { body: changes.body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { _meta: META, ...params } }) }),
  });
}
function dependencies(options = {}) {
  const authCalls = [];
  const dispatchCalls = [];
  return {
    authCalls, dispatchCalls,
    authenticate: async (request) => {
      authCalls.push(request);
      if (options.authError) throw new Error("Do not reveal credential");
      return options.authResult ?? { context: options.context ?? context };
    },
    dispatch: async (request) => {
      dispatchCalls.push(request);
      if (options.dispatchError) throw new Error(`Do not reveal ${TOKEN}`);
      return options.response ?? Response.json({ items: [{ id: "task-1", title: "Example" }], cursor: "next-page" });
    },
  };
}
async function invoke(request, options = {}) {
  const deps = dependencies(options);
  const response = await handleMcp(request, deps);
  const body = await response.text();
  return { response, body: body ? JSON.parse(body) : null, deps };
}

test("discovery validates the token without cookie or caller-selected tenant context", async () => {
  const result = await invoke(rpc("server/discover", {}, { headers: { Cookie: "session=ignored", "X-Org": "another-org", "X-Project-ID": "another-project" } }));
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body.result.supportedVersions, [PROTOCOL_VERSION]);
  assert.equal(result.body.result.resultType, "complete");
  assert.equal(result.deps.authCalls[0].url, "https://app.noxhere.com/api/v1/services");
  assert.deepEqual([...result.deps.authCalls[0].headers.keys()], ["authorization"]);
  assert.equal(result.deps.dispatchCalls.length, 0);
  assert.equal(result.response.headers.get("Cache-Control"), "private, no-store");
});

test("only enumerated safe GET operations are exposed", async () => {
  const { body } = await invoke(rpc("tools/list"));
  assert.equal(body.result.tools.length, 10);
  for (const tool of body.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(!tool.inputSchema.properties.token);
    assert.ok(!tool.inputSchema.properties.projectId);
  }
  assert.ok(contract.operations.every((op) => op.method === "GET"));
  assert.ok(!body.result.tools.some((tool) => /incidents|keys|source|send|create|update|delete/i.test(tool.name)));
});

test("feedback detail reads are scope-bound metadata reads, never asset downloads", async () => {
  const report = { id: "report-1", title: "Example bug", evidence: [{ id: "asset-1", url: "/api/v1/feedback/assets/asset-1", mediaType: "image/png", size: 123 }] };
  const result = await invoke(rpc("tools/call", { name: "spots_get_report", arguments: { reportId: "report-1" } }), { response: Response.json({ report }) });
  assert.equal(result.body.result.isError, false);
  assert.deepEqual(result.body.result.structuredContent.data.report, report);
  assert.equal(result.deps.dispatchCalls.length, 1);
  assert.equal(new URL(result.deps.dispatchCalls[0].url).pathname, "/api/v1/feedback/reports/report-1");
  const denied = await invoke(rpc("tools/call", { name: "spots_get_report", arguments: { reportId: "report-1" } }), { context: { ...context, scopes: ["services:read"] } });
  assert.equal(denied.body.result.structuredContent.error.code, "insufficient_scope");
  assert.equal(denied.deps.dispatchCalls.length, 0);
  const foreign = await invoke(rpc("tools/call", { name: "spots_get_report", arguments: { reportId: "foreign-project-report" } }), { response: new Response(null, { status: 404 }) });
  assert.equal(foreign.body.result.structuredContent.error.code, "noxhere_http_404");
  for (const reportId of ["../private", "with space", "a".repeat(121)]) {
    const invalid = await invoke(rpc("tools/call", { name: "spots_get_report", arguments: { reportId } }));
    assert.equal(invalid.body.error.code, -32602);
    assert.equal(invalid.deps.dispatchCalls.length, 0);
  }
});

test("tool listing is filtered by the authenticated token scopes", async () => {
  const result = await invoke(rpc("tools/list"), { context: { ...context, scopes: ["services:read", "planning:read"] } });
  assert.deepEqual(result.body.result.tools.map((tool) => tool.name), ["work_list_tasks", "work_list_features", "work_list_specs", "work_get_spec"]);
});

test("calling a tool without its scope is denied before dispatch", async () => {
  const result = await invoke(rpc("tools/call", { name: "activity_list_events" }), { context: { ...context, scopes: ["services:read"] } });
  assert.equal(result.body.result.isError, true);
  assert.equal(result.body.result.structuredContent.error.code, "insufficient_scope");
  assert.equal(result.deps.dispatchCalls.length, 0);
});

test("a successful read reuses full gateway dispatch and trusted tenant context", async () => {
  const result = await invoke(rpc("tools/call", { name: "activity_list_events", arguments: { limit: 20, mode: "merged", repo: "Playnist", before: "next page/1" } }, { headers: { Cookie: "ignored", "X-Org": "untrusted", "X-Project-ID": "untrusted" } }));
  assert.equal(result.body.result.isError, false);
  const dispatched = result.deps.dispatchCalls[0];
  const url = new URL(dispatched.url);
  assert.equal(url.pathname, "/api/v1/activity");
  assert.equal(url.searchParams.get("before"), "next page/1");
  assert.equal(dispatched.headers.get("X-Org"), context.orgLogin);
  assert.equal(dispatched.headers.get("X-Project-ID"), context.projectId);
  assert.equal(dispatched.headers.get("Cookie"), null);
  assert.equal(dispatched.headers.get("Authorization"), `Bearer ${TOKEN}`);
  assert.equal(dispatched.method, "GET");
  assert.equal(dispatched.redirect, "error");
  assert.deepEqual(JSON.parse(result.body.result.content[0].text), result.body.result.structuredContent);
});

for (const [label, args] of [
  ["unknown argument", { token: "not allowed" }],
  ["tenant override", { projectId: "another-project" }],
  ["arbitrary URL", { url: "https://attacker.invalid" }],
  ["oversized page", { page_size: 201 }],
  ["negative page", { page: -1 }],
  ["string instead of integer", { page: "1" }],
  ["prototype-key argument", JSON.parse('{"__proto__":{"polluted":true}}')],
  ["query control characters", { repo: "evil\nrepo" }],
]) {
  test(`rejects ${label}`, async () => {
    const result = await invoke(rpc("tools/call", { name: "work_list_issues", arguments: args }));
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  });
}

for (const value of ["..", ".", "../secrets", "%2e%2e", "nested/repo", "nested\\repo", "repo?token=bad"]) {
  test(`rejects path traversal/separator ${value}`, async () => {
    const result = await invoke(rpc("tools/call", { name: "work_get_issue", arguments: { repo: value, number: 1 } }));
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  });
}

test("required paths, enum values, and oneOf parameters are validated", async () => {
  for (const params of [
    { name: "work_get_issue", arguments: { repo: "Playnist" } },
    { name: "activity_list_events", arguments: { mode: "bad" } },
    { name: "work_list_tasks", arguments: { featureNumber: "wrong" } },
    { name: "work_list_tasks", arguments: null },
  ]) assert.equal((await invoke(rpc("tools/call", params))).body.error.code, -32602);
  for (const featureNumber of [1, "general"]) {
    assert.equal((await invoke(rpc("tools/call", { name: "work_list_tasks", arguments: { featureNumber } }))).body.result.isError, false);
  }
});

test("known credential patterns are redacted from JSON values and property names", async () => {
  const response = Response.json({
    config: { apiKey: "fixture-key", environments: [{ token: "fixture-token", name: "production" }] },
    githubLastError: `Authorization Bearer ${TOKEN}; other ghp_fixtureabc; xoxb-fixturedef`,
    note: "https://example.test/?access_token=fixture-token&ok=true",
    items: [{ title: "Normal task" }],
    [TOKEN]: "credential used as property name",
  });
  const result = await invoke(rpc("tools/call", { name: "spots_get_report", arguments: { reportId: "report-1" } }), { response });
  const text = JSON.stringify(result.body);
  for (const secret of [TOKEN, "fixture-key", "fixture-token", "ghp_fixtureabc", "xoxb-fixturedef"]) assert.ok(!text.includes(secret));
  assert.equal(result.body.result.structuredContent.data.config.environments[0].name, "production");
  assert.equal(result.body.result.structuredContent.data.items[0].title, "Normal task");
});

test("request identifiers and unsupported versions do not echo connection credentials", async () => {
  for (const id of [TOKEN, "x".repeat(129), "unsafe\nidentifier"]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id, method: "server/discover", params: { _meta: META } });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.body.error.code, -32600);
    assert.equal(Object.hasOwn(result.body, "id"), false);
  }
  const result = await invoke(rpc("server/discover", { _meta: { ...META, "io.modelcontextprotocol/protocolVersion": TOKEN } }));
  assert.equal(result.body.error.code, -32602);
  assert.ok(!JSON.stringify(result.body).includes(TOKEN));
});

for (const auth of [null, "Bearer ghp_not_a_real_token", "Bearer nox_at_not_a_real_token", "Bearer bad", "Basic Zm9vOmJhcg=="]) {
  test(`rejects unsupported or missing credentials ${auth?.split(" ")[0] ?? "missing"}`, async () => {
    const result = await invoke(rpc("server/discover", {}, { headers: { Authorization: auth } }));
    assert.equal(result.response.status, 401);
    assert.equal(result.deps.authCalls.length, 0);
  });
}

test("invalid, expired, revoked, or wrong-project tokens remain rejected by native auth", async () => {
  for (const status of [401, 403, 404]) {
    const result = await invoke(rpc(), { authResult: { response: new Response(null, { status }) } });
    assert.equal(result.response.status, status);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("rejects non-token auth contexts, missing project, and missing discovery scope", async () => {
  for (const invalid of [{ ...context, credentialType: "session" }, { ...context, projectId: null }, { ...context, scopes: ["activity:read"] }]) {
    assert.equal((await invoke(rpc(), { context: invalid })).response.status, 403);
  }
});

test("auth exceptions return no credential or stack information", async () => {
  const result = await invoke(rpc(), { authError: true });
  assert.equal(result.response.status, 503);
  assert.ok(!JSON.stringify(result.body).includes(TOKEN));
});

test("cross-origin, credential-in-query, wrong endpoint and method requests are rejected", async () => {
  assert.equal((await invoke(rpc("server/discover", {}, { headers: { Origin: "https://attacker.invalid" } }))).response.status, 403);
  assert.equal((await invoke(rpc("server/discover", {}, { url: "https://app.noxhere.com/mcp?key=forbidden" }))).response.status, 400);
  assert.equal((await invoke(rpc("server/discover", {}, { url: "https://app.noxhere.com/not-mcp" }))).response.status, 404);
  assert.equal((await invoke(rpc("server/discover", {}, { method: "GET" }))).response.status, 405);
});

test("protocol/header mismatches are rejected", async () => {
  for (const headers of [{ "Mcp-Method": null }, { "Mcp-Method": "tools/call" }, { "MCP-Protocol-Version": "2025-11-25" }]) {
    const result = await invoke(rpc("server/discover", {}, { headers }));
    assert.equal(result.body.error.code, -32020);
  }
  const wrongName = await invoke(rpc("tools/call", { name: "activity_list_events" }, { headers: { "Mcp-Name": "work_list_issues" } }));
  assert.equal(wrongName.body.error.code, -32020);
});

test("header sentinel encoding is decoded before tool-name comparison", async () => {
  const name = "activity_list_events";
  const result = await invoke(rpc("tools/call", { name }, { headers: { "Mcp-Name": `=?base64?${btoa(name)}?=` } }));
  assert.equal(result.body.result.isError, false);
});

test("unsupported versions and missing client metadata are explicit errors", async () => {
  assert.equal((await invoke(rpc("server/discover", { _meta: { ...META, "io.modelcontextprotocol/protocolVersion": "2025-11-25" } }))).body.error.code, -32022);
  const draft = await invoke(rpc("server/discover", { _meta: { ...META, "io.modelcontextprotocol/protocolVersion": "draft" } }));
  assert.equal(draft.body.error.code, -32022);
  assert.deepEqual(draft.body.error.data, { supported: [PROTOCOL_VERSION], requested: "draft" });
  assert.equal((await invoke(rpc("server/discover", { _meta: { "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION } }))).body.error.code, -32602);
  assert.equal((await invoke(rpc("server/discover", { _meta: {} }))).body.error.code, -32602);
  const withoutClientInfo = { ...META };
  delete withoutClientInfo["io.modelcontextprotocol/clientInfo"];
  assert.equal((await invoke(rpc("server/discover", { _meta: withoutClientInfo }))).response.status, 200);
});

test("unknown methods and write tools are not callable", async () => {
  assert.equal((await invoke(rpc("initialize"))).response.status, 404);
  assert.equal((await invoke(rpc("tools/call", { name: "noxhere_create_task" }))).body.error.code, -32602);
});

test("JSON batching, malformed/large requests, and non-JSON content are rejected", async () => {
  assert.equal((await invoke(rpc("server/discover", {}, { body: "[{}]" }))).body.error.code, -32600);
  assert.equal((await invoke(rpc("server/discover", {}, { body: "{" }))).body.error.code, -32700);
  assert.equal((await invoke(rpc("server/discover", {}, { body: "x".repeat(MAX_REQUEST_BYTES + 1) }))).response.status, 413);
  assert.equal((await invoke(rpc("server/discover", {}, { headers: { "Content-Type": "text/plain" } }))).response.status, 415);
});

test("upstream failures preserve Retry-After without exposing body or secrets", async () => {
  const response = new Response(JSON.stringify({ secret: TOKEN }), { status: 429, headers: { "Retry-After": "30" } });
  const result = await invoke(rpc("tools/call", { name: "activity_list_events" }), { response });
  assert.equal(result.body.result.isError, true);
  assert.equal(result.body.result.structuredContent.error.retryAfterSeconds, 30);
  assert.ok(!JSON.stringify(result.body).includes(TOKEN));
});

test("upstream exception, non-JSON and oversized output fail safely", async () => {
  const query = () => rpc("tools/call", { name: "activity_list_events" });
  const failure = await invoke(query(), { dispatchError: true });
  assert.ok(!JSON.stringify(failure.body).includes(TOKEN));
  assert.equal(failure.body.result.isError, true);
  assert.equal((await invoke(query(), { response: new Response("<html>login</html>") })).body.result.structuredContent.error.code, "invalid_response");
  const large = Response.json({ data: "x".repeat(MAX_RESPONSE_BYTES + 1) });
  assert.equal((await invoke(query(), { response: large })).body.result.structuredContent.error.code, "response_too_large");
});

test("two callers cannot reuse a cached project, context, token, or response", async () => {
  for (const projectId of ["project-a", "project-b"]) {
    const result = await invoke(rpc("tools/call", { name: "work_list_features" }), { context: { ...context, projectId } });
    assert.equal(result.deps.authCalls.length, 1);
    assert.equal(result.deps.dispatchCalls[0].headers.get("X-Project-ID"), projectId);
  }
});

test("product taxonomy is explicit and unsupported areas are never advertised", async () => {
  const broad = { ...context, scopes: [...context.scopes, "issues:read", "growth:read", "usage:read", "telemetry:read", "admin:write"] };
  const { body } = await invoke(rpc("tools/list"), { context: broad });
  assert.deepEqual(contract.domains.map((domain) => domain.name), ["Spots", "Incidents", "Work", "Growth", "Usage", "Activity", "Admin"]);
  assert.deepEqual(body.result.tools.map((tool) => tool.name), [
    "spots_get_report", "incidents_list", "work_list_tasks", "work_list_features", "work_list_specs", "work_get_spec",
    "work_list_issues", "work_get_issue", "activity_list_events", "activity_list_pull_requests", "activity_get_pull_request",
  ]);
  assert.ok(!body.result.tools.some((tool) => /^(growth|usage|admin)_/.test(tool.name)));
  for (const tool of body.result.tools) {
    assert.equal(tool.description.split("\n").length, 2);
    assert.ok(tool.description.length <= 180);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(!Object.hasOwn(tool.inputSchema, "oneOf"), "list and detail must have separate unambiguous schemas");
  }
});

test("every advertised operation has an exact GET mapping and matching parameter schemas", () => {
  assert.equal(new Set(contract.operations.map((op) => op.name)).size, contract.operations.length);
  for (const op of contract.operations) {
    assert.equal(op.method, "GET");
    assert.ok(op.path.startsWith("/api/v1/"));
    assert.deepEqual(Object.keys(op.inputSchema.properties).sort(), op.parameters.map((parameter) => parameter.name).sort());
    for (const parameter of op.parameters) {
      const { description: _description, ...schema } = op.inputSchema.properties[parameter.name];
      const { description: _parameterDescription, ...parameterSchema } = parameter.schema;
      assert.deepEqual(schema, parameterSchema);
      assert.ok(["path", "query"].includes(parameter.in));
      if (parameter.name === "page_size") assert.equal(schema.maximum, 200);
    }
  }
});

test("incident listing binds the token project and excludes unrelated overview data", async () => {
  const errors = [{ id: "inc_fixture", title: "Runtime failure", occurrence_count: 2 }];
  const incidentContext = { ...context, projectId: "project-fixture", scopes: [...context.scopes, "issues:read"] };
  const result = await invoke(rpc("tools/call", { name: "incidents_list" }, { headers: { "X-Project-ID": "attacker-project" } }), {
    context: incidentContext,
    response: Response.json({ project: { id: "project-fixture" }, errors, sources: [{ privateKey: "excluded" }], metrics: [{ value: 12345 }] }),
  });
  assert.equal(result.body.result.isError, false);
  assert.deepEqual(result.body.result.structuredContent.data.incidents, errors);
  assert.deepEqual(result.body.result.structuredContent.data.coverage, { limit: 50, unresolvedOnly: true, completeHistory: false, order: "last_seen_at_desc" });
  assert.ok(!JSON.stringify(result.body).includes("12345"));
  assert.ok(!JSON.stringify(result.body).includes("excluded"));
  assert.equal(new URL(result.deps.dispatchCalls[0].url).pathname, "/api/v1/projects/project-fixture/incidents");
  assert.equal(result.deps.dispatchCalls[0].headers.get("X-Project-ID"), "project-fixture");
});

test("incident read requires its existing optional scope and accepts no selector overrides", async () => {
  const listing = await invoke(rpc("tools/list"));
  assert.ok(!listing.body.result.tools.some((tool) => tool.name === "incidents_list"));
  const denied = await invoke(rpc("tools/call", { name: "incidents_list" }));
  assert.equal(denied.body.result.structuredContent.error.code, "insufficient_scope");
  assert.equal(denied.deps.dispatchCalls.length, 0);
  for (const arguments_ of [{ projectId: "other" }, { incidentId: "inc_other" }, { limit: 100 }, { status: "resolved" }]) {
    const result = await invoke(rpc("tools/call", { name: "incidents_list", arguments: arguments_ }), { context: { ...context, scopes: [...context.scopes, "issues:read"] } });
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("malformed or over-limit incident responses fail closed", async () => {
  for (const data of [{}, { errors: null }, { errors: Array.from({ length: 51 }, () => ({})) }]) {
    const result = await invoke(rpc("tools/call", { name: "incidents_list" }), { context: { ...context, scopes: [...context.scopes, "issues:read"] }, response: Response.json(data) });
    assert.equal(result.body.result.isError, true);
  }
});

test("malformed authenticated project paths cannot become resource paths", async () => {
  for (const projectId of ["..", "../other", "%2fother", "other?key=bad", "line\nfeed"]) {
    const result = await invoke(rpc("tools/call", { name: "incidents_list" }), { context: { ...context, projectId, scopes: [...context.scopes, "issues:read"] } });
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("repository issues remain Work with activity scope, not runtime Incidents", async () => {
  const result = await invoke(rpc("tools/call", { name: "work_get_issue", arguments: { repo: "repo", number: 1 } }), { context: { ...context, scopes: ["services:read", "issues:read"] } });
  assert.equal(result.body.result.structuredContent.error.code, "insufficient_scope");
  assert.equal(result.deps.dispatchCalls.length, 0);
});

test("list and detail inputs never mix, and both page boundaries match discovery", async () => {
  for (const [name, arguments_] of [
    ["work_list_specs", { specId: 1 }], ["work_get_spec", { specId: 1, include: "all" }],
    ["work_list_issues", { repo: "repo", number: 1 }], ["work_get_issue", { repo: "repo", number: 1, page: 1 }],
    ["activity_list_pull_requests", { repo: "repo", number: 1 }], ["activity_get_pull_request", { repo: "repo", number: 1, state: "open" }],
  ]) {
    const result = await invoke(rpc("tools/call", { name, arguments: arguments_ }));
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
  for (const name of ["work_list_issues", "activity_list_pull_requests"]) {
    for (const page_size of [1, 200]) {
      const result = await invoke(rpc("tools/call", { name, arguments: { page_size } }));
      assert.equal(result.body.result.isError, false);
      assert.equal(new URL(result.deps.dispatchCalls[0].url).searchParams.get("page_size"), String(page_size));
    }
    for (const page_size of [0, 201, 5000]) assert.equal((await invoke(rpc("tools/call", { name, arguments: { page_size } }))).body.error.code, -32602);
  }
});

test("every tool rechecks scope before dispatch, including write-equivalent credentials", async () => {
  for (const op of contract.operations) {
    const args = Object.fromEntries((op.inputSchema.required ?? []).map((name) => [name, op.inputSchema.properties[name].type === "integer" ? 1 : "fixture"]));
    const denied = await invoke(rpc("tools/call", { name: op.name, arguments: args }), { context: { ...context, scopes: ["services:read"] } });
    assert.equal(denied.body.result.structuredContent.error.code, "insufficient_scope");
    assert.equal(denied.deps.dispatchCalls.length, 0);
    const allowed = await invoke(rpc("tools/call", { name: op.name, arguments: args }), {
      context: { ...context, scopes: ["services:read", op.scope.replace(":read", ":write")] },
      response: Response.json(op.projection === "incidents" ? { errors: [] } : { items: [] }),
    });
    assert.equal(allowed.body.result.isError, false);
    assert.equal(allowed.deps.dispatchCalls.length, 1);
    assert.equal(allowed.deps.dispatchCalls[0].method, "GET");
  }
});

test("missing Accept capabilities and cross-origin non-POST requests are rejected", async () => {
  for (const Accept of [null, "application/json", "text/event-stream", "*/*"]) {
    assert.equal((await invoke(rpc("server/discover", {}, { headers: { Accept } }))).response.status, 406);
  }
  assert.equal((await invoke(rpc("server/discover", {}, { method: "GET", headers: { Origin: "https://attacker.invalid" } }))).response.status, 403);
});

test("revocation between independent requests cannot reuse discovery authorization", async () => {
  let revoked = false;
  const deps = dependencies();
  const originalAuthenticate = deps.authenticate;
  deps.authenticate = async (request) => revoked ? { response: new Response(null, { status: 401 }) } : originalAuthenticate(request);
  assert.equal((await handleMcp(rpc("tools/list"), deps)).status, 200);
  revoked = true;
  assert.equal((await handleMcp(rpc("tools/call", { name: "work_list_features" }), deps)).status, 401);
  assert.equal(deps.dispatchCalls.length, 0);
});


test("unidentified protocol errors omit the id property instead of returning null", async () => {
  for (const [body, code] of [
    ["{", -32700], ["", -32700], ["[{}]", -32600],
    [JSON.stringify({ jsonrpc: "2.0", method: "server/discover" }), -32600],
    ...[null, {}, [], true].map((id) => [JSON.stringify({ jsonrpc: "2.0", id, method: "server/discover" }), -32600]),
  ]) {
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 400);
    assert.deepEqual(Object.keys(result.body).sort(), ["error", "jsonrpc"]);
    assert.equal(result.body.jsonrpc, "2.0");
    assert.equal(result.body.error.code, code);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("omitted params produce metadata errors and preserve each safe request id", async () => {
  for (const id of [0, 7, -1, Number.MAX_SAFE_INTEGER, "", "request-7", "x".repeat(128)]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id, method: "server/discover" });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, { jsonrpc: "2.0", id, error: { code: -32602, message: "Required protocol metadata is missing." } });
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("explicit missing metadata remains an invalid-params error with the safe id", async () => {
  for (const params of [{}, { _meta: null }, { _meta: {} }, { _meta: { "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION } }]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id: "metadata-case", method: "server/discover", params });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 400);
    assert.equal(result.body.id, "metadata-case");
    assert.equal(result.body.error.code, -32602);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("malformed envelope fields stay rejected while readable safe ids are preserved", async () => {
  for (const changes of [{ jsonrpc: "1.0" }, { method: null }, { params: null }, { params: [] }, { params: "invalid" }, { unexpected: true }]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 0, method: "server/discover", params: { _meta: META }, ...changes });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 400);
    assert.equal(result.body.id, 0);
    assert.equal(result.body.error.code, -32600);
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});

test("safe ids retain their original value on successful responses", async () => {
  for (const id of [0, -7, "", "request-7"]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id, method: "server/discover", params: { _meta: META } });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, id);
    assert.equal(result.body.result.resultType, "complete");
  }
});

test("omitted params never allow unsafe or credential-bearing ids to be echoed", async () => {
  for (const id of [TOKEN, `prefix-${TOKEN}-suffix`, "x".repeat(129), "unsafe\nidentifier", 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const body = JSON.stringify({ jsonrpc: "2.0", id, method: "server/discover" });
    const result = await invoke(rpc("server/discover", {}, { body }));
    assert.equal(result.response.status, 400);
    assert.equal(Object.hasOwn(result.body, "id"), false);
    assert.equal(result.body.error.code, -32600);
    assert.ok(!JSON.stringify(result.body).includes(TOKEN));
    assert.equal(result.deps.dispatchCalls.length, 0);
  }
});
