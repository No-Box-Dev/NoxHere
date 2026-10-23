-- Foundation only: no credential bindings, provisioning or runtime admission.
-- Display roles are descriptive; the versioned policy is not a token scope.
CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  avatar_url TEXT,
  role_description TEXT NOT NULL DEFAULT '' CHECK (length(role_description) <= 2000),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'active', 'archived')),
  created_by TEXT NOT NULL REFERENCES principals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (org_id, id)
);

CREATE UNIQUE INDEX idx_projects_org_id_identity ON projects(org_id, id);

CREATE TABLE agent_project_grants (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  policy TEXT NOT NULL CHECK (policy = 'assigned_tasks_v1'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_by TEXT NOT NULL REFERENCES principals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  revoked_at TEXT,
  CHECK ((status = 'revoked' AND revoked_at IS NOT NULL) OR (status <> 'revoked' AND revoked_at IS NULL)),
  FOREIGN KEY (org_id, agent_id) REFERENCES agent_profiles(org_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, project_id) REFERENCES projects(org_id, id) ON DELETE RESTRICT
);

-- Preserve revoked grant history; replacement grants get new IDs.
CREATE UNIQUE INDEX idx_agent_project_grants_current
  ON agent_project_grants(org_id, agent_id, project_id) WHERE status <> 'revoked';

CREATE TRIGGER agent_profile_identity_immutable
BEFORE UPDATE OF id, org_id ON agent_profiles
WHEN NEW.id <> OLD.id OR NEW.org_id <> OLD.org_id
BEGIN
  SELECT RAISE(ABORT, 'agent identity is immutable');
END;

CREATE TRIGGER agent_grant_identity_immutable
BEFORE UPDATE OF id, org_id, agent_id, project_id, policy ON agent_project_grants
WHEN NEW.id <> OLD.id OR NEW.org_id <> OLD.org_id OR NEW.agent_id <> OLD.agent_id
  OR NEW.project_id <> OLD.project_id OR NEW.policy <> OLD.policy
BEGIN
  SELECT RAISE(ABORT, 'agent grant identity is immutable');
END;

CREATE TRIGGER agent_grant_revocation_terminal
BEFORE UPDATE OF status, revoked_at ON agent_project_grants
WHEN OLD.status = 'revoked' AND (NEW.status <> OLD.status OR NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'revoked grants cannot be restored');
END;
