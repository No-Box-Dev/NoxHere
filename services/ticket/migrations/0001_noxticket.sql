CREATE TABLE IF NOT EXISTS features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'open',
  body TEXT NOT NULL DEFAULT '',
  assignees_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assignees_json)),
  labels_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(labels_json)),
  milestone_title TEXT,
  html_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  gh_synced_at TEXT,
  UNIQUE (org_id, number)
);

CREATE INDEX IF NOT EXISTS idx_noxticket_features_org_state
  ON features (org_id, state, number);

CREATE TABLE IF NOT EXISTS specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  feature_number INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  links_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(links_json)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  archived_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_noxticket_specs_org_updated
  ON specs (org_id, archived, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_noxticket_specs_primary_per_feature
  ON specs (org_id, feature_number)
  WHERE is_primary = 1 AND archived = 0 AND feature_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS config (
  org_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (org_id, key)
);

CREATE TABLE IF NOT EXISTS spec_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  spec_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_noxticket_attachments_spec
  ON spec_attachments (org_id, spec_id, uploaded_at DESC);
