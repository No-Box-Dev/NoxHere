-- Replace historical split-product callback kinds with unified service kinds.
CREATE TABLE transport_callbacks_unified (
  transport_id       TEXT PRIMARY KEY REFERENCES transport_outbox(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('feedback_issue', 'telemetry_incident')),
  payload_json       TEXT NOT NULL CHECK (json_valid(payload_json)),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'queued', 'processing', 'completed')),
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  lease_expires_at   TEXT,
  last_error         TEXT,
  completed_at       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

INSERT INTO transport_callbacks_unified (
  transport_id, kind, payload_json, status, attempt_count, lease_expires_at,
  last_error, completed_at, created_at, updated_at
)
SELECT
  transport_id,
  CASE kind
    WHEN 'noxspot_issue' THEN 'feedback_issue'
    WHEN 'noxcue_incident' THEN 'telemetry_incident'
    ELSE kind
  END,
  payload_json, status, attempt_count, lease_expires_at,
  last_error, completed_at, created_at, updated_at
FROM transport_callbacks;

DROP TABLE transport_callbacks;
ALTER TABLE transport_callbacks_unified RENAME TO transport_callbacks;

CREATE INDEX transport_callbacks_recovery
  ON transport_callbacks(status, lease_expires_at, updated_at);
