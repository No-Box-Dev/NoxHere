-- Serve project-scoped feed pages in index order and resolve their PR metadata
-- without scanning the full pull_requests table once per event.
CREATE INDEX IF NOT EXISTS idx_events_feed_page
  ON events(owner_id, project_id, type, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pull_requests_project_repo_number
  ON pull_requests(project_id, repo, number);
