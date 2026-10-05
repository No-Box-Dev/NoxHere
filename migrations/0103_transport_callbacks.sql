-- Product state changes that depend on a provider receipt are retried
-- independently from the provider mutation. A delivered command is never
-- replayed merely because its local projection failed.
CREATE TABLE transport_callbacks (
  transport_id       TEXT PRIMARY KEY REFERENCES transport_outbox(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('noxspot_issue', 'noxcue_incident')),
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

CREATE INDEX transport_callbacks_recovery
  ON transport_callbacks(status, lease_expires_at, updated_at);
