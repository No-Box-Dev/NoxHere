PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS api_tokens_project_insert_guard;
DROP TRIGGER IF EXISTS api_tokens_project_update_guard;

ALTER TABLE api_tokens RENAME TO api_tokens_legacy_environment;

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'test')),
  token_prefix TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  scopes_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT
);

INSERT INTO api_tokens
  (id, org_id, project_id, name, environment, token_prefix, token_hash,
   scopes_json, created_by, created_at, expires_at, last_used_at, revoked_at)
SELECT id, org_id, project_id, name,
       CASE environment WHEN 'live' THEN 'production' ELSE environment END,
       token_prefix, token_hash, scopes_json, created_by, created_at,
       expires_at, last_used_at, revoked_at
  FROM api_tokens_legacy_environment;

DROP TABLE api_tokens_legacy_environment;

CREATE INDEX idx_api_tokens_org
  ON api_tokens(org_id, project_id, revoked_at, created_at);
CREATE INDEX idx_api_tokens_expiry
  ON api_tokens(expires_at, revoked_at);

CREATE TRIGGER api_tokens_project_insert_guard
BEFORE INSERT ON api_tokens
WHEN NOT EXISTS (
  SELECT 1 FROM projects
   WHERE id = NEW.project_id AND org_id = NEW.org_id
     AND enabled = 1 AND archived = 0
)
BEGIN
  SELECT RAISE(ABORT, 'api token project must be active in its organization');
END;

CREATE TRIGGER api_tokens_project_update_guard
BEFORE UPDATE OF org_id, project_id ON api_tokens
WHEN NOT EXISTS (
  SELECT 1 FROM projects
   WHERE id = NEW.project_id AND org_id = NEW.org_id
     AND enabled = 1 AND archived = 0
)
BEGIN
  SELECT RAISE(ABORT, 'api token project must be active in its organization');
END;

PRAGMA foreign_keys = ON;
