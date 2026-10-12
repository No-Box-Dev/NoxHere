-- NoxTicket owns features directly: no GitHub issue mirror. Features and specs
-- are scoped to a project. Both tables were empty in staging and production
-- when this ran (verified 2026-09-23), so they are recreated rather than altered.

DROP TABLE IF EXISTS spec_attachments;
DROP TABLE IF EXISTS specs;
DROP TABLE IF EXISTS features;

CREATE TABLE features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  status TEXT NOT NULL,
  backlog INTEGER NOT NULL DEFAULT 0 CHECK (backlog IN (0, 1)),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  plan TEXT NOT NULL DEFAULT '',
  owners_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(owners_json)),
  status_history_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(status_history_json)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX idx_noxticket_features_project_state
  ON features (org_id, project_id, state, id);

CREATE TABLE specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  feature_number INTEGER REFERENCES features (id),
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

CREATE INDEX idx_noxticket_specs_project_updated
  ON specs (org_id, project_id, archived, updated_at DESC);

CREATE UNIQUE INDEX uq_noxticket_specs_primary_per_feature
  ON specs (org_id, project_id, feature_number)
  WHERE is_primary = 1 AND archived = 0 AND feature_number IS NOT NULL;

CREATE TABLE spec_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  spec_id INTEGER NOT NULL REFERENCES specs (id),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_noxticket_attachments_spec
  ON spec_attachments (org_id, spec_id, uploaded_at DESC);
