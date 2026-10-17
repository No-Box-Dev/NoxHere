PRAGMA foreign_keys = OFF;

CREATE TABLE guest_access_grants_split (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'project', 'tool')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  service TEXT CHECK (service IN ('planning', 'activity', 'feedback', 'growth', 'usage', 'issues', 'telemetry')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  revoked_at TEXT,
  CHECK (
    (scope_type = 'organization' AND project_id IS NULL AND service IS NULL) OR
    (scope_type = 'project' AND project_id IS NOT NULL AND service IS NULL) OR
    (scope_type = 'tool' AND project_id IS NOT NULL AND service IS NOT NULL)
  )
);
INSERT INTO guest_access_grants_split
SELECT id, org_id, principal_id, scope_type, project_id, service, created_by, created_at, revoked_at
FROM guest_access_grants;
DROP TABLE guest_access_grants;
ALTER TABLE guest_access_grants_split RENAME TO guest_access_grants;
CREATE INDEX idx_guest_grants_principal_org
  ON guest_access_grants(principal_id, org_id, revoked_at);
CREATE UNIQUE INDEX idx_guest_grants_org_scope
  ON guest_access_grants(org_id, principal_id)
  WHERE scope_type = 'organization' AND revoked_at IS NULL;
CREATE UNIQUE INDEX idx_guest_grants_project_scope
  ON guest_access_grants(org_id, principal_id, project_id)
  WHERE scope_type = 'project' AND revoked_at IS NULL;
CREATE UNIQUE INDEX idx_guest_grants_tool_scope
  ON guest_access_grants(org_id, principal_id, project_id, service)
  WHERE scope_type = 'tool' AND revoked_at IS NULL;
CREATE TRIGGER guest_grants_project_insert_guard
BEFORE INSERT ON guest_access_grants
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest grant project must belong to organization');
END;
CREATE TRIGGER guest_grants_project_update_guard
BEFORE UPDATE OF org_id, project_id ON guest_access_grants
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest grant project must belong to organization');
END;

CREATE TABLE guest_invitations_split (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT COLLATE NOCASE NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'project', 'tool')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  service TEXT CHECK (service IN ('planning', 'activity', 'feedback', 'growth', 'usage', 'issues', 'telemetry')),
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
INSERT INTO guest_invitations_split
SELECT id, org_id, email, scope_type, project_id, service, token_hash, invited_by,
       expires_at, accepted_at, revoked_at, created_at
FROM guest_invitations;
DROP TABLE guest_invitations;
ALTER TABLE guest_invitations_split RENAME TO guest_invitations;
CREATE INDEX idx_guest_invites_org_created
  ON guest_invitations(org_id, created_at DESC);
CREATE INDEX idx_guest_invites_email
  ON guest_invitations(email, revoked_at, expires_at);
CREATE TRIGGER guest_invites_project_insert_guard
BEFORE INSERT ON guest_invitations
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest invitation project must belong to organization');
END;
CREATE TRIGGER guest_invites_project_update_guard
BEFORE UPDATE OF org_id, project_id ON guest_invitations
WHEN NEW.project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM projects WHERE id = NEW.project_id AND org_id = NEW.org_id
)
BEGIN
  SELECT RAISE(ABORT, 'guest invitation project must belong to organization');
END;

PRAGMA foreign_keys = ON;
