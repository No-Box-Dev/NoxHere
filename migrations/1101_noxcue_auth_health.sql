-- Reference-only schema contract. NoxConnect migration 0068 is authoritative.
CREATE TABLE IF NOT EXISTS cue_feature_results (
  org_id INTEGER NOT NULL, source_id TEXT NOT NULL, event_id TEXT NOT NULL,
  feature_key TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT,
  duration_ms INTEGER, is_test INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL, received_at TEXT NOT NULL,
  PRIMARY KEY (source_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_cue_feature_results_source_time
  ON cue_feature_results(source_id, feature_key, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cue_feature_results_retention ON cue_feature_results(received_at);
CREATE TABLE IF NOT EXISTS cue_feature_states (
  org_id INTEGER NOT NULL, source_id TEXT NOT NULL, feature_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0, incident_started_at TEXT,
  last_result_at TEXT, last_success_at TEXT, last_failure_at TEXT, last_reason TEXT,
  updated_at TEXT NOT NULL, PRIMARY KEY (source_id, feature_key)
);
CREATE TABLE IF NOT EXISTS cue_endpoint_monitors (
  org_id INTEGER NOT NULL, source_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0,
  url TEXT, status TEXT NOT NULL DEFAULT 'waiting', consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT, last_success_at TEXT, last_failure_at TEXT, last_error TEXT,
  last_status_code INTEGER, last_latency_ms INTEGER, last_transition_at TEXT,
  incident_started_at TEXT, updated_at TEXT NOT NULL
);
