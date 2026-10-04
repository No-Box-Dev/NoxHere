-- Error fingerprints are grouping data, not resource identifiers. Give every
-- incident group an immutable, URL-safe ID that clients can use for actions.
CREATE TABLE cue_error_groups_with_ids (
  id                TEXT NOT NULL DEFAULT ('inc_' || lower(hex(randomblob(16)))),
  org_id            INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id         TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  fingerprint       TEXT NOT NULL,
  title             TEXT NOT NULL,
  error_code        TEXT,
  component         TEXT,
  environment       TEXT,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  occurrence_count  INTEGER NOT NULL DEFAULT 1,
  last_notified_at  TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_at   TEXT,
  acknowledged_by   TEXT,
  resolved_at       TEXT,
  resolved_by       TEXT,
  PRIMARY KEY (source_id, fingerprint),
  UNIQUE (id)
);

INSERT INTO cue_error_groups_with_ids (
  id, org_id, source_id, fingerprint, title, error_code, component,
  environment, first_seen_at, last_seen_at, occurrence_count,
  last_notified_at, status, acknowledged_at, acknowledged_by,
  resolved_at, resolved_by
)
SELECT
  'inc_' || lower(hex(randomblob(16))), org_id, source_id, fingerprint,
  title, error_code, component, environment, first_seen_at, last_seen_at,
  occurrence_count, last_notified_at, status, acknowledged_at,
  acknowledged_by, resolved_at, resolved_by
FROM cue_error_groups;

DROP TABLE cue_error_groups;
ALTER TABLE cue_error_groups_with_ids RENAME TO cue_error_groups;

CREATE INDEX idx_cue_error_groups_org_last_seen
  ON cue_error_groups(org_id, last_seen_at DESC);
CREATE INDEX idx_cue_error_groups_org_status_last_seen
  ON cue_error_groups(org_id, status, last_seen_at DESC);

