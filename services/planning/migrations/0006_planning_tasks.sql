CREATE TABLE planning_tasks (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  owner_login TEXT NOT NULL,
  created_by TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue' CHECK (color IN ('gray', 'blue', 'purple', 'green', 'yellow', 'orange', 'red', 'pink')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  feature_id INTEGER REFERENCES features (id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_noxticket_tasks_owner
  ON planning_tasks (org_id, project_id, owner_login, status, position, created_at);

CREATE INDEX idx_noxticket_tasks_feature
  ON planning_tasks (org_id, project_id, feature_id, status, position, created_at);
