CREATE TABLE cue_engagement_settings (
  org_id       INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  window_days  INTEGER NOT NULL DEFAULT 7 CHECK (window_days IN (7, 14, 30)),
  updated_by   TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (org_id, project_id)
);
