ALTER TABLE planning_tasks ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'todo';

CREATE INDEX idx_noxticket_tasks_stage
  ON planning_tasks (org_id, project_id, owner_login, stage_id, position, created_at);
