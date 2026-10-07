-- Unified identified/anonymous tracking, source-level reporting policy,
-- retention configuration, card presentation, and ingest-key audit history.

ALTER TABLE cue_sources ADD COLUMN allowed_events_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(allowed_events_json));
ALTER TABLE cue_sources ADD COLUMN report_title TEXT;
ALTER TABLE cue_sources ADD COLUMN production_stats INTEGER NOT NULL DEFAULT 0
  CHECK (production_stats IN (0, 1));
ALTER TABLE cue_sources ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 62
  CHECK (retention_days BETWEEN 7 AND 730);
ALTER TABLE cue_sources ADD COLUMN aggregate_only_slack INTEGER NOT NULL DEFAULT 0
  CHECK (aggregate_only_slack IN (0, 1));

ALTER TABLE cue_source_keys ADD COLUMN valid_until TEXT;
ALTER TABLE cue_source_keys ADD COLUMN rotated_from_key_id TEXT;

CREATE TABLE cue_tracked_events (
  org_id          INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id       TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  value           REAL NOT NULL CHECK (value > 0 AND value <= 1000000000),
  subject_hash    TEXT,
  period          TEXT NOT NULL,
  attributes_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes_json)),
  occurred_at     TEXT NOT NULL,
  received_at     TEXT NOT NULL,
  PRIMARY KEY (source_id, event_id)
);

CREATE INDEX idx_cue_tracked_events_period
  ON cue_tracked_events(source_id, period, name, subject_hash);
CREATE INDEX idx_cue_tracked_events_subject
  ON cue_tracked_events(source_id, subject_hash, name, occurred_at)
  WHERE subject_hash IS NOT NULL;

CREATE TABLE cue_source_card_settings (
  org_id            INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id         TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  metric_key        TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  position          INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 99),
  daily_label       TEXT,
  cumulative_label  TEXT,
  per_active_enabled INTEGER NOT NULL DEFAULT 0 CHECK (per_active_enabled IN (0, 1)),
  updated_by        TEXT NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (source_id, metric_key)
);

CREATE TABLE cue_source_key_audit (
  id          TEXT PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  key_id      TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('created', 'rotated', 'revoked')),
  actor       TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_cue_source_key_audit_source
  ON cue_source_key_audit(source_id, created_at DESC);

CREATE TABLE cue_source_audit (
  id           TEXT PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  actor        TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_cue_source_audit_source
  ON cue_source_audit(org_id, source_id, created_at DESC);

CREATE TABLE cue_source_key_daily_usage (
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  key_id      TEXT NOT NULL,
  period      TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  first_used_at TEXT NOT NULL,
  last_used_at  TEXT NOT NULL,
  PRIMARY KEY (key_id, period)
);
