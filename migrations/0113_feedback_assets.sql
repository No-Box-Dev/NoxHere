-- Feedback evidence is stored privately in R2 and authorized through the
-- NoxHere API. Records may be created before the GitHub issue and spot_reports
-- row exist, so report_id is deliberately not a foreign key.
CREATE TABLE feedback_assets (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL,
  org_id        INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id    TEXT,
  site_id       TEXT NOT NULL REFERENCES spot_sites(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN (
                  'screenshot', 'follow_up_screenshot', 'dom_snapshot', 'console_log',
                  'network_log', 'video', 'attachment', 'diagnostic_bundle'
                )),
  media_type    TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256        TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at    TEXT,
  deleted_at    TEXT
);

CREATE INDEX feedback_assets_report
  ON feedback_assets(org_id, project_id, report_id, created_at);

CREATE INDEX feedback_assets_expiry
  ON feedback_assets(expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
