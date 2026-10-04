import assert from "node:assert/strict";
import worker from "../workers/api-gateway/.generated/index.js";

const secret = "incident-router-test-secret";
const incidentId = "inc_0123456789abcdef0123456789abcdef";
const pathname = `/api/v1/projects/proj_playnist/incidents/${incidentId}`;
const fingerprint = "error.occurred/browser.fetch/http_502/get_api_feeds_discover_failed";
const encoder = new TextEncoder();

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function assertionHeaders(method, signedPath = pathname) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = {
    version: 1,
    issuer: "noxhere",
    audience: "noxconnect",
    issuedAt: now,
    expiresAt: now + 30,
    method,
    path: signedPath,
    auth: {
      credentialType: "native_session",
      credentialId: "session_test",
      principalId: "principal_test",
      userLogin: "jasper",
      userId: 196446605,
      orgId: 7,
      orgLogin: "acme",
      isAdmin: true,
      projectId: null,
      scopes: [],
      connectionId: null,
    },
  };
  const payload = base64Url(encoder.encode(JSON.stringify(assertion)));
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = base64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return {
    "Content-Type": "application/json",
    "X-NoxHere-Internal-Assertion": payload,
    "X-NoxHere-Internal-Signature": signature,
  };
}

const queries = [];
const DB = {
  prepare(sql) {
    const statement = {
      binds: [],
      bind(...binds) { statement.binds = binds; queries.push({ sql, binds }); return statement; },
      async first() {
        if (sql.includes("FROM orgs WHERE id")) return { id: 7, github_login: "acme", suspended_at: null };
        if (sql.includes("FROM projects")) return { id: "proj_playnist", name: "Playnist", archived: 0, enabled: 1 };
        if (sql.includes("FROM project_config") || sql.includes("FROM config")) return null;
        if (sql.includes("FROM cue_error_groups incident")) return {
          id: incidentId,
          source_id: "source-1",
          source_name: "Playnist Production",
          fingerprint,
          title: "Discover failed",
          error_code: "http_502",
          component: "browser.fetch",
          environment: "production",
          first_seen_at: "2026-09-25T00:00:00.000Z",
          last_seen_at: "2026-09-26T00:00:00.000Z",
          occurrence_count: 3,
          status: "resolved",
          acknowledged_at: null,
          acknowledged_by: null,
          resolved_at: "2026-09-26T00:00:00.000Z",
          resolved_by: "jasper",
        };
        if (sql.includes("UPDATE cue_error_groups")) return {
          id: incidentId,
          source_id: "source-1",
          source_name: null,
          fingerprint,
          title: "Discover failed",
          error_code: "http_502",
          component: "browser.fetch",
          environment: "production",
          first_seen_at: "2026-09-25T00:00:00.000Z",
          last_seen_at: "2026-09-26T00:00:00.000Z",
          occurrence_count: 3,
          status: "resolved",
          acknowledged_at: null,
          acknowledged_by: null,
          resolved_at: "2026-09-26T00:00:00.000Z",
          resolved_by: "jasper",
        };
        throw new Error(`Unexpected first() query: ${sql}`);
      },
      async all() { return { results: [] }; },
    };
    return statement;
  },
  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.all()));
  },
};

const env = {
  DB,
  NOXHERE_INTERNAL_SECRET: secret,
  PLATFORM_ADMIN_GITHUB_IDS: "196446605",
  ASSETS: { fetch: async () => new Response("Unexpected asset fallback", { status: 500 }) },
};

for (const [capability, expectedCollection] of [
  ["activity", "events"],
  ["issues", "data"],
  ["incidents", "errors"],
]) {
  const capabilityPath = `/api/v1/projects/proj_playnist/${capability}`;
  const capabilityResponse = await worker.fetch(new Request(`https://connector.internal${capabilityPath}`, {
    method: "GET",
    headers: await assertionHeaders("GET", capabilityPath),
  }), env, { waitUntil() {} });
  const capabilityBody = await capabilityResponse.json();
  assert.equal(capabilityResponse.status, 200, `${capability}: ${JSON.stringify(capabilityBody)}`);
  assert.ok(Array.isArray(capabilityBody[expectedCollection]), `${capability} did not reach its project handler`);
}

const readResponse = await worker.fetch(new Request(`https://connector.internal${pathname}`, {
  method: "GET",
  headers: await assertionHeaders("GET"),
}), env, { waitUntil() {} });
const readBody = await readResponse.json();
assert.equal(readResponse.status, 200, JSON.stringify(readBody));
assert.equal(readBody.incident.id, incidentId);
assert.equal(readBody.incident.sourceName, "Playnist Production");
assert.equal(readBody.incident.status, "resolved");
assert.equal(readBody.incident.fingerprint, fingerprint);

const response = await worker.fetch(new Request(`https://connector.internal${pathname}`, {
  method: "PATCH",
  headers: await assertionHeaders("PATCH"),
  body: JSON.stringify({ status: "resolved" }),
}), env, { waitUntil() {} });

const body = await response.json();
assert.equal(response.status, 200, JSON.stringify(body));
assert.equal(body.incident.id, incidentId);
assert.equal(body.incident.status, "resolved");
assert.equal(body.incident.fingerprint, fingerprint);
const update = queries.find((query) => query.sql.includes("UPDATE cue_error_groups"));
assert.ok(update, "The routed request did not reach the incident update");
assert.match(update.sql, /WHERE id = \?/);
assert.doesNotMatch(update.sql, /fingerprint = \?/);
assert.ok(update.binds.includes(incidentId));
assert.ok(update.binds.includes("proj_playnist"));

console.log("Compiled Pages router served project Activity, Issues, Incidents, and fixed-ID incident actions.");
