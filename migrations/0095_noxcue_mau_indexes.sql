-- Rolling activity-per-MAU cards filter by source and a 30-day period range,
-- then deduplicate subjects. Put the range column before the distinct value so
-- SQLite can seek directly into each source's monthly window.
CREATE INDEX IF NOT EXISTS idx_cue_user_active_days_source_period_subject
  ON cue_user_active_days(source_id, period, subject_hash);
