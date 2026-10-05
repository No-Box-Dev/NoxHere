PRAGMA foreign_keys = ON;

-- Email identities complement GitHub identities. The legacy GitHub columns
-- remain populated with non-provider placeholders for email-only principals;
-- linking GitHub replaces them with verified provider claims.
ALTER TABLE principals ADD COLUMN email TEXT COLLATE NOCASE;
ALTER TABLE principals ADD COLUMN display_name TEXT;
ALTER TABLE principals ADD COLUMN github_connection_id TEXT;
UPDATE principals
   SET github_connection_id = (
     SELECT session.connection_id
       FROM browser_sessions session
      WHERE session.principal_id = principals.id AND session.connection_id IS NOT NULL
      ORDER BY session.created_at DESC LIMIT 1
   )
 WHERE github_login NOT LIKE 'guest-%';
CREATE UNIQUE INDEX IF NOT EXISTS idx_principals_email
  ON principals(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS principal_emails (
  email TEXT COLLATE NOCASE PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_principal_emails_principal
  ON principal_emails(principal_id);

CREATE TABLE IF NOT EXISTS guest_access_grants (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'project', 'tool')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  service TEXT CHECK (service IN ('noxticket', 'noxfeed', 'noxspot', 'noxcue')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  revoked_at TEXT,
  CHECK (
    (scope_type = 'organization' AND project_id IS NULL AND service IS NULL) OR
    (scope_type = 'project' AND project_id IS NOT NULL AND service IS NULL) OR
    (scope_type = 'tool' AND project_id IS NOT NULL AND service IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_guest_grants_principal_org
  ON guest_access_grants(principal_id, org_id, revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_grants_org_scope
  ON guest_access_grants(org_id, principal_id)
  WHERE scope_type = 'organization' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_grants_project_scope
  ON guest_access_grants(org_id, principal_id, project_id)
  WHERE scope_type = 'project' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_grants_tool_scope
  ON guest_access_grants(org_id, principal_id, project_id, service)
  WHERE scope_type = 'tool' AND revoked_at IS NULL;
CREATE TRIGGER IF NOT EXISTS guest_grants_project_insert_guard
BEFORE INSERT ON guest_access_grants
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest grant project must belong to organization');
END;
CREATE TRIGGER IF NOT EXISTS guest_grants_project_update_guard
BEFORE UPDATE OF org_id, project_id ON guest_access_grants
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest grant project must belong to organization');
END;

CREATE TABLE IF NOT EXISTS guest_invitations (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT COLLATE NOCASE NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'project', 'tool')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  service TEXT CHECK (service IN ('noxticket', 'noxfeed', 'noxspot', 'noxcue')),
  token_hash TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (
    (scope_type = 'organization' AND project_id IS NULL AND service IS NULL) OR
    (scope_type = 'project' AND project_id IS NOT NULL AND service IS NULL) OR
    (scope_type = 'tool' AND project_id IS NOT NULL AND service IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_guest_invites_org_created
  ON guest_invitations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_invites_email
  ON guest_invitations(email, revoked_at, expires_at);
CREATE TRIGGER IF NOT EXISTS guest_invites_project_insert_guard
BEFORE INSERT ON guest_invitations
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest invitation project must belong to organization');
END;
CREATE TRIGGER IF NOT EXISTS guest_invites_project_update_guard
BEFORE UPDATE OF org_id, project_id ON guest_invitations
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest invitation project must belong to organization');
END;

CREATE TABLE IF NOT EXISTS email_login_tokens (
  token_hash TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_login_tokens_principal
  ON email_login_tokens(principal_id, expires_at, consumed_at);
