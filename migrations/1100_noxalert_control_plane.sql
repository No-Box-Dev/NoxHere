-- NoxAlert control-plane schema for the shared Nox D1 database.
-- Raw OpenTelemetry data must never be inserted here; it belongs in ClickHouse.

CREATE TABLE IF NOT EXISTS alert_api_keys (
  id           TEXT PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_api_keys_owner ON alert_api_keys(owner_id, revoked_at);

CREATE TABLE IF NOT EXISTS alert_destinations (
  id               TEXT PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id         TEXT NOT NULL,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('slack')),
  slack_channel_id TEXT NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id                    TEXT PRIMARY KEY,
  org_id                INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id              TEXT NOT NULL,
  project_id            TEXT REFERENCES projects(id) ON DELETE SET NULL,
  destination_id        TEXT NOT NULL REFERENCES alert_destinations(id),
  name                   TEXT NOT NULL,
  signal                 TEXT NOT NULL CHECK (signal IN ('logs', 'metrics', 'traces')),
  query_json             TEXT NOT NULL,
  comparator             TEXT NOT NULL CHECK (comparator IN ('above', 'at_or_above', 'below', 'at_or_below')),
  threshold              REAL NOT NULL,
  window_seconds         INTEGER NOT NULL CHECK (window_seconds BETWEEN 60 AND 86400),
  interval_seconds       INTEGER NOT NULL CHECK (interval_seconds BETWEEN 60 AND 3600),
  consecutive_breaches   INTEGER NOT NULL DEFAULT 1 CHECK (consecutive_breaches BETWEEN 1 AND 60),
  consecutive_recoveries INTEGER NOT NULL DEFAULT 1 CHECK (consecutive_recoveries BETWEEN 1 AND 60),
  repeat_after_seconds   INTEGER NOT NULL DEFAULT 900 CHECK (repeat_after_seconds BETWEEN 0 AND 604800),
  enabled                INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  next_evaluation_at     TEXT,
  created_by             TEXT NOT NULL,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_due ON alert_rules(enabled, next_evaluation_at);
CREATE INDEX IF NOT EXISTS idx_alert_rules_owner ON alert_rules(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_incidents (
  id                 TEXT PRIMARY KEY,
  rule_id            TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  org_id              INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('firing', 'resolved')),
  started_at          TEXT NOT NULL,
  resolved_at         TEXT,
  last_value          REAL NOT NULL,
  last_evaluated_at   TEXT NOT NULL,
  notification_count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_incidents_one_open
  ON alert_incidents(rule_id) WHERE status = 'firing';
CREATE INDEX IF NOT EXISTS idx_alert_incidents_owner ON alert_incidents(owner_id, started_at DESC);

CREATE TABLE IF NOT EXISTS alert_events (
  id              TEXT PRIMARY KEY,
  incident_id     TEXT NOT NULL REFERENCES alert_incidents(id) ON DELETE CASCADE,
  rule_id         TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  transition      TEXT NOT NULL CHECK (transition IN ('firing', 'repeated', 'resolved')),
  value           REAL NOT NULL,
  evaluated_at    TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  destination_id   TEXT NOT NULL REFERENCES alert_destinations(id),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  slack_message_ts TEXT,
  last_error       TEXT,
  next_attempt_at  TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  delivered_at     TEXT,
  UNIQUE(event_id, destination_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_pending
  ON alert_deliveries(status, next_attempt_at);
