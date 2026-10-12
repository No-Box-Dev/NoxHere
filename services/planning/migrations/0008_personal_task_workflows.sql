CREATE TABLE task_workflows (
  org_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  owner_login TEXT NOT NULL COLLATE NOCASE,
  stages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (org_id, project_id, owner_login)
);

CREATE INDEX idx_planning_task_workflows_owner
  ON task_workflows (org_id, owner_login, project_id);
