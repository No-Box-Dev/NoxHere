-- Reference-only NoxCue schema contract. NoxConnect is the migration authority.
CREATE TABLE IF NOT EXISTS cue_sources (
  id                   TEXT PRIMARY KEY,
  org_id               INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id             TEXT NOT NULL,
  project_id           TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name                 TEXT NOT NULL,
  environment          TEXT NOT NULL DEFAULT 'production'
                       CHECK (environment IN ('production', 'staging', 'development', 'preview', 'test', 'local')),
  enabled              INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  alerts_enabled       INTEGER NOT NULL DEFAULT 1 CHECK (alerts_enabled IN (0, 1)),
  allowed_origins_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allowed_origins_json)),
  timezone             TEXT NOT NULL DEFAULT 'UTC',
  digest_enabled       INTEGER NOT NULL DEFAULT 1 CHECK (digest_enabled IN (0, 1)),
  digest_time_local    TEXT NOT NULL DEFAULT '00:30',
  error_cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  created_by           TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cue_metric_definitions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  domain TEXT NOT NULL,
  unit TEXT NOT NULL,
  origin TEXT NOT NULL,
  description TEXT NOT NULL,
  formula_key TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cue_daily_metrics (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  metric_key TEXT NOT NULL REFERENCES cue_metric_definitions(key),
  value REAL NOT NULL,
  origin TEXT NOT NULL,
  formula_version INTEGER,
  reported_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_id, period, metric_key)
);

CREATE TABLE IF NOT EXISTS cue_user_registrations (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  period TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (source_id, subject_hash)
);

CREATE TABLE IF NOT EXISTS cue_user_active_days (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (source_id, period, subject_hash)
);

CREATE TABLE IF NOT EXISTS cue_error_groups (
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL,
  last_notified_at TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  PRIMARY KEY (source_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS cue_digest_runs (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  outbox_id TEXT REFERENCES delivery_outbox(id) ON DELETE SET NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_id, period)
);

CREATE TABLE IF NOT EXISTS cue_source_keys (
  id           TEXT PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id    TEXT NOT NULL REFERENCES cue_sources(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('publishable', 'secret')),
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT,
  revoked_at   TEXT
);
