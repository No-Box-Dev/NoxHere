-- Privacy-preserving Growth attribution dimensions.
-- Raw browser identifiers are hashed by the Telemetry Worker before storage.
CREATE TABLE growth_event_dimensions (
  org_id INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  visitor_hash TEXT,
  session_hash TEXT,
  user_hash TEXT,
  channel TEXT NOT NULL DEFAULT 'Direct',
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,
  term TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  plan TEXT,
  amount_minor INTEGER,
  currency TEXT,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (source_id, event_id)
);

CREATE INDEX idx_growth_dimensions_source_time
  ON growth_event_dimensions(source_id, occurred_at DESC);
CREATE INDEX idx_growth_dimensions_channel_time
  ON growth_event_dimensions(source_id, channel, occurred_at DESC);
CREATE INDEX idx_growth_dimensions_campaign_time
  ON growth_event_dimensions(source_id, campaign, occurred_at DESC)
  WHERE campaign IS NOT NULL;

CREATE TABLE growth_visitors (
  org_id INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  user_hash TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  first_channel TEXT NOT NULL,
  first_source TEXT,
  first_medium TEXT,
  first_campaign TEXT,
  first_referrer_host TEXT,
  first_landing_path TEXT,
  last_channel TEXT NOT NULL,
  last_source TEXT,
  last_medium TEXT,
  last_campaign TEXT,
  last_referrer_host TEXT,
  last_landing_path TEXT,
  PRIMARY KEY (source_id, visitor_hash)
);

CREATE INDEX idx_growth_visitors_user
  ON growth_visitors(source_id, user_hash)
  WHERE user_hash IS NOT NULL;
