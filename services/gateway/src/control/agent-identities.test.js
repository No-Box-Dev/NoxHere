import { afterEach, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { AGENT_PROJECT_POLICY } from "../../../../packages/contracts/agent-identities.ts";

const directory = new URL("../../migrations/", import.meta.url);
const migrationName = "0007_agent_identity_foundation.sql";
const databases = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function fixture() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql") && name < migrationName).sort()) {
    db.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  db.exec(`
    INSERT INTO orgs(id, github_login) VALUES (1, 'one'), (2, 'two');
    INSERT INTO principals(id, github_user_id, github_login) VALUES ('human', 42, 'maintainer');
    INSERT INTO org_memberships(org_id, principal_id, role) VALUES (1, 'human', 'admin');
    INSERT INTO projects(id, org_id, name, enabled) VALUES ('a', 1, 'A', 1), ('b', 1, 'B', 1), ('foreign', 2, 'Foreign', 1);
    INSERT INTO api_tokens(id, org_id, project_id, name, environment, token_prefix, token_hash, scopes_json, created_by)
      VALUES ('legacy', 1, 'a', 'fixture', 'test', 'fixture', 'not-a-secret', '["planning:read"]', 'human');
  `);
  return db;
}
const migrate = (db) => db.exec(readFileSync(new URL(migrationName, directory), "utf8"));
function profile(db, id = "agent", org = 1) {
  db.prepare("INSERT INTO agent_profiles(id, org_id, name, created_by) VALUES (?, ?, 'Reviewer', 'human')").run(id, org);
}
function grant(db, id = "grant", agent = "agent", org = 1, project = "a", policy = AGENT_PROJECT_POLICY) {
  db.prepare("INSERT INTO agent_project_grants(id, org_id, agent_id, project_id, policy, created_by) VALUES (?, ?, ?, ?, ?, 'human')")
    .run(id, org, agent, project, policy);
}

test("full migration chain preserves existing identities and credentials and creates no agents or grants", () => {
  const db = fixture();
  const tables = ["principals", "org_memberships", "projects", "api_tokens"];
  const before = tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all());
  migrate(db);
  expect(tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  expect(db.prepare("SELECT * FROM agent_profiles").all()).toEqual([]);
  expect(db.prepare("SELECT * FROM agent_project_grants").all()).toEqual([]);
  expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});

test("profiles and grants default to inert states; names do not define identity", () => {
  const db = fixture(); migrate(db); profile(db); profile(db, "other"); grant(db);
  expect(db.prepare("SELECT status FROM agent_profiles").all().map((row) => row.status)).toEqual(["disabled", "disabled"]);
  expect(db.prepare("SELECT status, policy FROM agent_project_grants").get()).toEqual({ status: "pending", policy: "assigned_tasks_v1" });
  expect(() => grant(db, "broad", "other", 1, "a", "planning:write")).toThrow();
});

test("foreign organization projects and agents cannot be linked", () => {
  const db = fixture(); migrate(db); profile(db); profile(db, "foreign-agent", 2);
  expect(() => grant(db, "bad-project", "agent", 1, "foreign")).toThrow(/FOREIGN KEY/);
  expect(() => grant(db, "bad-agent", "foreign-agent", 1, "a")).toThrow(/FOREIGN KEY/);
  expect(() => grant(db, "missing", "absent", 1, "a")).toThrow(/FOREIGN KEY/);
  grant(db);
  expect(db.prepare("SELECT id FROM agent_project_grants WHERE project_id = 'b'").all()).toEqual([]);
  expect(() => db.exec("UPDATE agent_project_grants SET project_id = 'b' WHERE id = 'grant'")).toThrow(/immutable/);
});

test("profile identity cannot move across organizations or change IDs", () => {
  const db = fixture(); migrate(db); profile(db);
  expect(() => db.exec("UPDATE agent_profiles SET org_id = 2")).toThrow(/immutable/);
  expect(() => db.exec("UPDATE agent_profiles SET id = 'replacement'")).toThrow(/immutable/);
  db.exec("UPDATE agent_profiles SET name = 'Renamed', avatar_url = 'https://example.test/avatar.png'");
  expect(db.prepare("SELECT id FROM agent_profiles").get().id).toBe("agent");
});

test("revocation preserves history and replacement grants cannot revive prior IDs", () => {
  const db = fixture(); migrate(db); profile(db); grant(db);
  expect(() => grant(db, "duplicate")).toThrow(/UNIQUE/);
  expect(() => db.exec("UPDATE agent_project_grants SET status = 'revoked'")).toThrow(/CHECK/);
  db.exec("UPDATE agent_project_grants SET status = 'revoked', revoked_at = '2026-10-23T00:00:00Z'");
  expect(() => db.exec("UPDATE agent_project_grants SET status = 'active', revoked_at = NULL")).toThrow(/cannot be restored/);
  expect(() => db.exec("UPDATE agent_project_grants SET revoked_at = '2026-10-24T00:00:00Z'")).toThrow(/cannot be restored/);
  grant(db, "replacement");
  expect(db.prepare("SELECT count(*) AS count FROM agent_project_grants").get().count).toBe(2);
});

test("referenced identities and projects cannot be deleted out from under grant history", () => {
  const db = fixture(); migrate(db); profile(db); grant(db);
  expect(() => db.exec("DELETE FROM agent_profiles WHERE id = 'agent'")).toThrow(/FOREIGN KEY/);
  expect(() => db.exec("DELETE FROM projects WHERE id = 'a'")).toThrow(/FOREIGN KEY/);
  expect(() => db.exec("DELETE FROM principals WHERE id = 'human'")).toThrow(/FOREIGN KEY/);
});
