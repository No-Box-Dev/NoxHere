-- Canonical application-wide event log. Producers use one validated envelope;
-- specialized activity, feedback, reliability, and engagement tables remain
-- read-model projections rather than competing event formats.
CREATE TABLE platform_events (
  id                TEXT PRIMARY KEY,
  spec_version      INTEGER NOT NULL CHECK (spec_version = 1),
  data_version      INTEGER NOT NULL CHECK (data_version = 1),
  type              TEXT NOT NULL,
  org_id            INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_component  TEXT NOT NULL,
  source_id         TEXT NOT NULL DEFAULT '',
  subject_type      TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  actor_type        TEXT,
  actor_id          TEXT,
  context_json      TEXT CHECK (context_json IS NULL OR json_valid(context_json)),
  message_json      TEXT CHECK (message_json IS NULL OR json_valid(message_json)),
  data_json         TEXT NOT NULL CHECK (json_valid(data_json)),
  idempotency_key   TEXT NOT NULL,
  correlation_id    TEXT,
  causation_id      TEXT,
  occurred_at       TEXT NOT NULL,
  received_at       TEXT NOT NULL,
  projection_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (projection_status IN ('pending', 'queued', 'processing', 'projected', 'failed')),
  projection_attempts INTEGER NOT NULL DEFAULT 0,
  last_queued_at    TEXT,
  projected_at      TEXT,
  last_error        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (source_component, source_id, idempotency_key)
);

CREATE INDEX platform_events_project_time
  ON platform_events(org_id, project_id, occurred_at DESC);
CREATE INDEX platform_events_type_time
  ON platform_events(org_id, project_id, type, occurred_at DESC);
CREATE INDEX platform_events_projection_recovery
  ON platform_events(projection_status, updated_at, received_at);
CREATE INDEX platform_events_correlation
  ON platform_events(org_id, correlation_id, occurred_at)
  WHERE correlation_id IS NOT NULL;
