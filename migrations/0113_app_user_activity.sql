CREATE TABLE IF NOT EXISTS telemetry_app_user_activity (
  app_id TEXT NOT NULL CHECK (app_id IN ('noxhere', 'activity')),
  github_login TEXT NOT NULL COLLATE NOCASE,
  registered_at TEXT NOT NULL,
  last_active_period TEXT NOT NULL,
  last_event_at TEXT NOT NULL,
  PRIMARY KEY (app_id, github_login)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_app_user_activity_period
  ON telemetry_app_user_activity(app_id, last_active_period);
