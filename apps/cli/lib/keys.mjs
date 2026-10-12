export const KEY_ENVIRONMENTS = Object.freeze(["production", "staging", "test"]);

export const KEY_PRESETS = Object.freeze({
  ingest: Object.freeze(["telemetry:ingest", "feedback:submit"]),
  write: Object.freeze(["telemetry:ingest", "feedback:submit", "slack:send", "developer-feedback:write"]),
  read: Object.freeze(["services:read", "activity:read", "feedback:read", "telemetry:read"]),
});

export const KEY_SCOPES = new Set([
  "services:read", "developer-feedback:write", "slack:send",
  "activity:read", "activity:write", "feedback:submit", "feedback:read", "feedback:write",
  "telemetry:ingest", "telemetry:read", "telemetry:write",
]);

export function scopesForKey({ preset = "write", scopes = [] } = {}) {
  if (!(preset in KEY_PRESETS)) throw new Error(`Unknown key preset '${preset}'. Choose ingest, write, or read.`);
  const result = [...new Set([...KEY_PRESETS[preset], ...scopes])].sort();
  const invalid = result.filter((scope) => !KEY_SCOPES.has(scope));
  if (invalid.length) throw new Error(`Unknown key scope: ${invalid.join(", ")}.`);
  return result;
}

export function keyEnvironment(value = "production") {
  if (!KEY_ENVIRONMENTS.includes(value)) {
    throw new Error(`Unknown key environment '${value}'. Choose production, staging, or test.`);
  }
  return value;
}

export function requireKeyProject(session) {
  const projectId = session.context?.project;
  if (!projectId) throw new Error("Choose a project first with `noxhere use <organization>/<project>`.");
  return projectId;
}

export function printTokenRecord(token) {
  const state = token.revokedAt ? "revoked" : "active";
  return `${token.name}\t${token.id}\t${token.environment}\t${state}\t${token.prefix}…\t${(token.scopes || []).join(",")}`;
}
