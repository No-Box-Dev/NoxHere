import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest, ensureAccess, projectCapabilityPath, projectsFromPayload, resolveProject, selectContext } from "../lib/client.mjs";

const session = {
  apiBase: "https://example.test",
  accessToken: "nox_at_test",
  accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  organizations: [{ login: "Acme" }, { login: "Other" }],
};

test("context switching retains the account login", () => {
  const selected = selectContext(session, "acme/project-1");
  assert.equal(selected.accessToken, session.accessToken);
  assert.deepEqual(selected.context, { organization: "Acme", project: "project-1" });
});

test("organization-only context addresses all projects", () => {
  assert.deepEqual(selectContext(session, "Acme").context, { organization: "Acme", project: null });
});

test("every service request shares the login and selected context", async () => {
  let captured;
  const active = selectContext(session, "Acme/project-1");
  const fetchImpl = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await apiRequest(active, "/api/v1/cues/events", { fetchImpl });
  assert.equal(captured.init.headers.get("Authorization"), "Bearer nox_at_test");
  assert.equal(captured.init.headers.get("X-Org"), "Acme");
  assert.equal(captured.init.headers.get("X-Project-ID"), "project-1");
});

test("unknown organizations are rejected locally", () => {
  assert.throws(() => selectContext(session, "missing/project"), /not available/);
});

test("project names and slugs resolve to the stable project id", () => {
  const projects = projectsFromPayload({ projects: [{ id: "proj_123", name: "Web", slug: "web" }] });
  assert.equal(resolveProject(projects, "Web").id, "proj_123");
  assert.equal(resolveProject(projects, "web").id, "proj_123");
  assert.equal(resolveProject(projects, "proj_123").id, "proj_123");
});

test("capability commands use explicit project resource paths", () => {
  const active = selectContext(session, "Acme/project with space");
  assert.equal(
    projectCapabilityPath(active, "incidents"),
    "/api/v1/projects/project%20with%20space/incidents",
  );
  assert.throws(() => projectCapabilityPath(selectContext(session, "Acme"), "activity"), /Choose a project/);
});

test("concurrent agents rotate a refresh token only once", async () => {
  let current = {
    ...session,
    accessToken: "nox_at_expired",
    refreshToken: "nox_rt_old",
    accessExpiresAt: new Date(0).toISOString(),
  };
  let refreshes = 0;
  let tail = Promise.resolve();
  const withRefreshLock = (task) => {
    const result = tail.then(task, task);
    tail = result.then(() => {}, () => {});
    return result;
  };
  const fetchImpl = async () => {
    refreshes += 1;
    return new Response(JSON.stringify({
      access_token: "nox_at_rotated",
      refresh_token: "nox_rt_rotated",
      expires_in: 900,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const options = {
    fetchImpl,
    load: async () => current,
    withRefreshLock,
  };
  const save = async (next) => { current = next; };
  const [first, second] = await Promise.all([
    ensureAccess(current, save, options),
    ensureAccess(current, save, options),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(first.accessToken, "nox_at_rotated");
  assert.equal(second.accessToken, "nox_at_rotated");
});
