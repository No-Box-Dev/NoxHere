import assert from "node:assert/strict";
import test from "node:test";
import { keyEnvironment, requireKeyProject, scopesForKey } from "../lib/keys.mjs";

test("write keys receive the bounded cross-service write preset", () => {
  assert.deepEqual(scopesForKey({ preset: "write" }), [
    "developer-feedback:write", "slack:send", "telemetry:ingest",
  ]);
});

test("custom key scopes are validated and deduplicated", () => {
  assert.deepEqual(scopesForKey({ preset: "ingest", scopes: ["telemetry:ingest", "services:read"] }), [
    "services:read", "telemetry:ingest",
  ]);
  assert.throws(() => scopesForKey({ preset: "write", scopes: ["everything:write"] }), /Unknown key scope/);
});

test("environment and project scoping are mandatory", () => {
  assert.equal(keyEnvironment("staging"), "staging");
  assert.throws(() => keyEnvironment("live"), /Unknown key environment/);
  assert.equal(requireKeyProject({ context: { project: "project-1" } }), "project-1");
  assert.throws(() => requireKeyProject({ context: { project: null } }), /Choose a project/);
});
