-- Provider-neutral outbound command log. Existing delivery_outbox remains in
-- place during Slack/GitHub dual-write cutovers and is retired only after M7.
CREATE TABLE transport_outbox (
  id                 TEXT PRIMARY KEY,
  org_id             INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_event_id    TEXT REFERENCES platform_events(id) ON DELETE SET NULL,
  correlation_id     TEXT,
  provider           TEXT NOT NULL CHECK (provider IN ('slack', 'github')),
  operation          TEXT NOT NULL,
  route              TEXT NOT NULL,
  idempotency_key    TEXT NOT NULL,
  command_json       TEXT NOT NULL CHECK (json_valid(command_json)),
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'queued', 'processing', 'retrying',
                                       'blocked', 'delivered', 'failed')),
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  max_attempts       INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at    TEXT,
  lease_expires_at   TEXT,
  last_error_code    TEXT,
  last_error         TEXT,
  receipt_json       TEXT CHECK (receipt_json IS NULL OR json_valid(receipt_json)),
  delivered_at       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (provider, operation, idempotency_key)
);

CREATE INDEX transport_outbox_project_status
  ON transport_outbox(org_id, project_id, status, updated_at);
CREATE INDEX transport_outbox_recovery
  ON transport_outbox(status, next_attempt_at, lease_expires_at, created_at);
CREATE INDEX transport_outbox_source_event
  ON transport_outbox(source_event_id)
  WHERE source_event_id IS NOT NULL;
