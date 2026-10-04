-- Durable read models derived exclusively from platform_events. Fact rows are
-- append-only/idempotent; current-state rows use event time plus event ID as a
-- deterministic tie-breaker so delayed Queue delivery cannot rewind state.
CREATE TABLE platform_projection_events (
  event_id       TEXT PRIMARY KEY REFERENCES platform_events(id) ON DELETE CASCADE,
  model          TEXT NOT NULL CHECK (model IN ('activity', 'reliability', 'engagement', 'feedback', 'delivery')),
  org_id         INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  subject_type   TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  occurred_at    TEXT NOT NULL,
  summary        TEXT,
  data_json      TEXT NOT NULL CHECK (json_valid(data_json)),
  projected_at   TEXT NOT NULL
);

CREATE INDEX platform_projection_events_model_time
  ON platform_projection_events(org_id, project_id, model, occurred_at DESC, event_id DESC);

CREATE TABLE platform_projection_state (
  model             TEXT NOT NULL CHECK (model IN ('reliability', 'feedback')),
  org_id            INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subject_type      TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  state             TEXT NOT NULL,
  last_event_id     TEXT NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  last_event_type   TEXT NOT NULL,
  last_occurred_at  TEXT NOT NULL,
  data_json         TEXT NOT NULL CHECK (json_valid(data_json)),
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (model, org_id, project_id, subject_type, subject_id)
);

CREATE INDEX platform_projection_state_project
  ON platform_projection_state(org_id, project_id, model, state, last_occurred_at DESC);
