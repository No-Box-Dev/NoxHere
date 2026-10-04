-- Keep each product page on an index whose equality filters match the route
-- scope, followed by the column used for its newest-first listing.

-- NoxFeed Current/Issues and the reusable PR/issue collection endpoints.
CREATE INDEX IF NOT EXISTS idx_pull_requests_project_state_updated
  ON pull_requests(org_id, project_id, state, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_issues_project_state_updated
  ON issues(org_id, project_id, state, updated_at DESC, id DESC);

-- NoxSpot capture enrichment. Project routing already identifies the repo, so
-- omitting repo keeps this useful for other project-scoped event timelines.
CREATE INDEX IF NOT EXISTS idx_events_project_type_created
  ON events(org_id, project_id, type, created_at DESC, id DESC);

-- NoxCue first resolves the project's sources, then merges the newest facts
-- from three append-only event tables.
CREATE INDEX IF NOT EXISTS idx_cue_sources_project
  ON cue_sources(org_id, project_id, id);

CREATE INDEX IF NOT EXISTS idx_cue_user_registrations_source_occurred
  ON cue_user_registrations(source_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_cue_user_active_days_source_occurred
  ON cue_user_active_days(source_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_cue_activity_events_source_occurred
  ON cue_activity_events(source_id, occurred_at DESC);
