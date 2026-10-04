-- Project feeds are scoped through project_repositories so umbrella projects
-- can include activity written under their constituent repository ids. Keep
-- the newest matching narratives cheap to retrieve across that repo set.
CREATE INDEX IF NOT EXISTS idx_events_routed_feed_page
  ON events(owner_id, type, created_at DESC, id DESC, repo COLLATE NOCASE)
  WHERE type IN ('narrative', 'pr_narrative', 'release_notes');
