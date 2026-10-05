PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY,
  github_login TEXT COLLATE NOCASE UNIQUE NOT NULL,
  suspended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS principals (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER UNIQUE NOT NULL,
  github_login TEXT COLLATE NOCASE UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS org_memberships (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (org_id, principal_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_principal
  ON org_memberships(principal_id, org_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_projects_org_enabled
  ON projects(org_id, enabled, archived);

CREATE TABLE IF NOT EXISTS project_repositories (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  repo TEXT COLLATE NOCASE NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (org_id, repo)
);
CREATE INDEX IF NOT EXISTS idx_project_repositories_project
  ON project_repositories(org_id, project_id);

CREATE TABLE IF NOT EXISTS service_enablement (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('noxticket', 'noxfeed', 'noxspot', 'noxcue')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (org_id, service)
);

CREATE TABLE IF NOT EXISTS browser_sessions (
  token_hash TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  connection_id TEXT,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_expiry
  ON browser_sessions(expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS native_sessions (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  connection_id TEXT,
  client_name TEXT NOT NULL,
  access_token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  rotated_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_native_sessions_access
  ON native_sessions(access_token_hash, access_expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_native_sessions_refresh
  ON native_sessions(refresh_token_hash, refresh_expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'test')),
  token_prefix TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  scopes_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_org
  ON api_tokens(org_id, project_id, revoked_at, created_at);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expiry
  ON api_tokens(expires_at, revoked_at);

CREATE TRIGGER IF NOT EXISTS api_tokens_project_insert_guard
BEFORE INSERT ON api_tokens
WHEN NOT EXISTS (
  SELECT 1 FROM projects
   WHERE id = NEW.project_id AND org_id = NEW.org_id
     AND enabled = 1 AND archived = 0
)
BEGIN
  SELECT RAISE(ABORT, 'api token project must be active in its organization');
END;

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'api_token', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_org_created
  ON auth_audit_log(org_id, created_at);
