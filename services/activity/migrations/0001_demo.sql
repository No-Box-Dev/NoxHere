CREATE TABLE IF NOT EXISTS demo_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expiry ON demo_sessions(expires_at);

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  github_login TEXT,
  avatar_url TEXT,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  org TEXT NOT NULL,
  repo TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS members (
  login TEXT PRIMARY KEY,
  avatar_url TEXT,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  feed_mode TEXT,
  source TEXT NOT NULL DEFAULT 'github',
  actor_id TEXT,
  project_id TEXT,
  org TEXT NOT NULL,
  repo TEXT,
  pr_number INTEGER,
  summary TEXT NOT NULL,
  age_seconds INTEGER NOT NULL,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_feed ON events(feed_mode, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_pr ON events(repo, pr_number, id DESC);

CREATE TABLE IF NOT EXISTS pull_requests (
  id INTEGER PRIMARY KEY,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar TEXT,
  draft INTEGER NOT NULL DEFAULT 0,
  head_ref TEXT,
  created_age_seconds INTEGER NOT NULL,
  updated_age_seconds INTEGER NOT NULL,
  html_url TEXT,
  merged_age_seconds INTEGER,
  requested_reviewers_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(repo, number)
);

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar TEXT,
  created_age_seconds INTEGER NOT NULL,
  updated_age_seconds INTEGER NOT NULL,
  html_url TEXT,
  assignees_json TEXT NOT NULL DEFAULT '[]',
  labels_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(repo, number)
);

DELETE FROM actors;
INSERT INTO actors (id, name, github_login, avatar_url, kind) VALUES
  ('actor-reviewer', 'NoxFeed Reviewer', 'reviewer-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 'human'),
  ('actor-alex', 'Alex Morgan', 'alex-demo', 'https://avatars.githubusercontent.com/u/9919?v=4', 'human'),
  ('actor-priya', 'Priya Shah', 'priya-demo', 'https://avatars.githubusercontent.com/u/69631?v=4', 'human'),
  ('actor-sam', 'Sam Rivera', 'sam-demo', 'https://avatars.githubusercontent.com/u/810438?v=4', 'human');

DELETE FROM members;
INSERT INTO members (login, avatar_url, kind, sort_order) VALUES
  ('reviewer-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 'human', 0),
  ('alex-demo', 'https://avatars.githubusercontent.com/u/9919?v=4', 'human', 1),
  ('priya-demo', 'https://avatars.githubusercontent.com/u/69631?v=4', 'human', 2),
  ('sam-demo', 'https://avatars.githubusercontent.com/u/810438?v=4', 'human', 3);

DELETE FROM projects;
INSERT INTO projects (id, name, slug, org, repo, archived) VALUES
  ('project-macos', 'NoxFeed for macOS', 'noxfeed-macos', 'NoxFeed-Demo', 'noxfeed-macos', 0),
  ('project-api', 'Activity API', 'activity-api', 'NoxFeed-Demo', 'activity-api', 0),
  ('project-web', 'Team Dashboard', 'team-dashboard', 'NoxFeed-Demo', 'team-dashboard', 0);

DELETE FROM pull_requests;
INSERT INTO pull_requests (id, repo, number, title, state, author, author_avatar, draft, head_ref, created_age_seconds, updated_age_seconds, html_url, merged_age_seconds, requested_reviewers_json) VALUES
  (101, 'noxfeed-macos', 128, 'Add grouped review activity to the timeline', 'open', 'reviewer-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 0, 'feature/grouped-reviews', 172800, 1800, 'https://github.com/swiftlang/swift/pull/82800', NULL, '[{"login":"priya-demo"}]'),
  (102, 'activity-api', 87, 'Keep organization feed pagination stable', 'open', 'alex-demo', 'https://avatars.githubusercontent.com/u/9919?v=4', 0, 'fix/feed-cursors', 259200, 7200, 'https://github.com/github/docs/pull/40000', NULL, '[{"login":"reviewer-demo"},{"login":"sam-demo"}]'),
  (103, 'team-dashboard', 54, 'Prototype workload summary cards', 'open', 'priya-demo', 'https://avatars.githubusercontent.com/u/69631?v=4', 1, 'prototype/workload-cards', 86400, 10800, 'https://github.com/vercel/next.js/pull/80000', NULL, '[]'),
  (104, 'noxfeed-macos', 126, 'Clarify disconnected and empty organization states', 'merged', 'sam-demo', 'https://avatars.githubusercontent.com/u/810438?v=4', 0, 'fix/org-empty-states', 432000, 21600, 'https://github.com/swiftlang/swift/pull/82700', 21600, '[{"login":"reviewer-demo"}]');

DELETE FROM issues;
INSERT INTO issues (id, repo, number, title, state, author, author_avatar, created_age_seconds, updated_age_seconds, html_url, assignees_json, labels_json) VALUES
  (201, 'noxfeed-macos', 42, 'Keyboard shortcut should reopen the feed reliably', 'open', 'alex-demo', 'https://avatars.githubusercontent.com/u/9919?v=4', 345600, 14400, 'https://github.com/swiftlang/swift/issues/80000', '["reviewer-demo"]', '["bug","macOS"]'),
  (202, 'activity-api', 31, 'Document organization connection states', 'open', 'reviewer-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 259200, 28800, 'https://github.com/github/docs/issues/39000', '["alex-demo"]', '["documentation"]'),
  (203, 'team-dashboard', 19, 'Improve empty-state contrast in dark mode', 'open', 'sam-demo', 'https://avatars.githubusercontent.com/u/810438?v=4', 172800, 43200, 'https://github.com/vercel/next.js/issues/79000', '["priya-demo"]', '["design","accessibility"]');

DELETE FROM events;
INSERT INTO events (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json) VALUES
  (1200, 'narrative', 'narrative', 'github', 'actor-sam', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, 'I cleaned up the organization states so a quiet connected team no longer looks broken, and an unconnected team gets a direct setup path.', 21600, '{"action":"closed","pr_number":126,"pr":{"number":126,"title":"Clarify disconnected and empty organization states","html_url":"https://github.com/swiftlang/swift/pull/82700","author":"sam-demo","head_ref":"fix/org-empty-states","base_ref":"main","additions":148,"deletions":37,"changed_files":6}}'),
  (1199, 'release_notes', 'release_notes', 'github', 'actor-sam', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, '✅ noxfeed-macos #126 Shipped - Bugfix\nRepository: noxfeed-macos\nPull Request: #126 - Clarify disconnected and empty organization states\nAuthor: sam-demo | Merged by: sam-demo\nBranch: fix/org-empty-states → main\n\nChange Summary\nType: Bugfix\nDetails: Organization setup and genuinely empty feeds now have distinct states. Users can connect NoxConnect without mistaking a quiet feed for a failed installation.\nBreaking Changes: None identified\nAffected Areas: organization selection, onboarding, empty states\n\nRecommendations\nVerify both a new organization and a connected organization with no events.', 21600, '{"action":"closed","pr_number":126,"pr":{"number":126,"title":"Clarify disconnected and empty organization states","html_url":"https://github.com/swiftlang/swift/pull/82700","author":"sam-demo","head_ref":"fix/org-empty-states","base_ref":"main"}}'),
  (1198, 'github:pr:merged', NULL, 'github', 'actor-sam', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, 'Clarify disconnected and empty organization states', 21600, '{"action":"closed","pr":{"number":126,"title":"Clarify disconnected and empty organization states","html_url":"https://github.com/swiftlang/swift/pull/82700","author":"sam-demo","head_ref":"fix/org-empty-states","base_ref":"main","additions":148,"deletions":37,"changed_files":6}}'),
  (1197, 'github:pr:review:approved', NULL, 'github', 'actor-reviewer', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, 'Approved organization state improvements', 25200, '{"action":"submitted","pr":{"number":126,"title":"Clarify disconnected and empty organization states","html_url":"https://github.com/swiftlang/swift/pull/82700","author":"sam-demo"},"review":{"state":"approved","author":"reviewer-demo","body":"The connected-empty distinction reads clearly now."}}'),
  (1196, 'github:push', NULL, 'github', 'actor-sam', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, 'Polish organization setup copy', 28800, '{"ref":"refs/heads/fix/org-empty-states","pusher":"sam-demo","commits":[{"message":"Polish organization setup copy"}]}'),
  (1195, 'github:pr:opened', NULL, 'github', 'actor-sam', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 126, 'Clarify disconnected and empty organization states', 432000, '{"action":"opened","pr":{"number":126,"title":"Clarify disconnected and empty organization states","html_url":"https://github.com/swiftlang/swift/pull/82700","author":"sam-demo","body":"Makes organization readiness explicit for every installation state.","head_ref":"fix/org-empty-states","base_ref":"main","additions":148,"deletions":37,"changed_files":6,"draft":false}}'),
  (1194, 'pr_narrative', 'pr_narrative', 'github', 'actor-reviewer', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 128, 'I grouped review activity into one timeline so the important decisions are visible without wading through repeated status rows.', 1800, '{"action":"opened","pr_number":128,"pr":{"number":128,"title":"Add grouped review activity to the timeline","html_url":"https://github.com/swiftlang/swift/pull/82800","author":"reviewer-demo","body":"Groups related review events while preserving the complete history.","head_ref":"feature/grouped-reviews","base_ref":"main","additions":221,"deletions":64,"changed_files":8,"draft":false}}'),
  (1193, 'github:pr:opened', NULL, 'github', 'actor-reviewer', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 128, 'Add grouped review activity to the timeline', 172800, '{"action":"opened","pr":{"number":128,"title":"Add grouped review activity to the timeline","html_url":"https://github.com/swiftlang/swift/pull/82800","author":"reviewer-demo","body":"Groups related review events while preserving the complete history.","head_ref":"feature/grouped-reviews","base_ref":"main","additions":221,"deletions":64,"changed_files":8,"draft":false}}'),
  (1192, 'github:push', NULL, 'github', 'actor-reviewer', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 128, 'Refine grouped review rendering', 1800, '{"ref":"refs/heads/feature/grouped-reviews","pusher":"reviewer-demo","commits":[{"message":"Refine grouped review rendering"}]}'),
  (1191, 'github:pr:review:commented', NULL, 'github', 'actor-priya', 'project-macos', 'NoxFeed-Demo', 'noxfeed-macos', 128, 'Review feedback on grouped activity', 1200, '{"action":"submitted","pr":{"number":128,"title":"Add grouped review activity to the timeline","html_url":"https://github.com/swiftlang/swift/pull/82800","author":"reviewer-demo"},"review":{"state":"commented","author":"priya-demo","body":"Could the group header retain the latest reviewer name?"}}'),
  (1190, 'pr_narrative', 'pr_narrative', 'github', 'actor-alex', 'project-api', 'NoxFeed-Demo', 'activity-api', 87, 'I made feed cursors deterministic so rapid webhook traffic cannot duplicate or skip cards while someone is paging backward.', 7200, '{"action":"opened","pr_number":87,"pr":{"number":87,"title":"Keep organization feed pagination stable","html_url":"https://github.com/github/docs/pull/40000","author":"alex-demo","body":"Uses stable IDs as cursors for organization-scoped event pages.","head_ref":"fix/feed-cursors","base_ref":"main","additions":96,"deletions":22,"changed_files":4,"draft":false}}'),
  (1189, 'narrative', 'narrative', 'github', 'actor-priya', 'project-web', 'NoxFeed-Demo', 'team-dashboard', 51, 'I tightened the workload cards so review requests, authored PRs, and assigned issues scan as one coherent queue.', 93600, '{"action":"closed","pr_number":51,"pr":{"number":51,"title":"Unify workload cards","html_url":"https://github.com/vercel/next.js/pull/80000","author":"priya-demo","head_ref":"feature/workload-cards","base_ref":"main"}}'),
  (1188, 'release_notes', 'release_notes', 'github', 'actor-priya', 'project-web', 'NoxFeed-Demo', 'team-dashboard', 51, '✅ team-dashboard #51 Shipped - Feature\nRepository: team-dashboard\nPull Request: #51 - Unify workload cards\nAuthor: priya-demo | Merged by: priya-demo\nBranch: feature/workload-cards → main\n\nChange Summary\nType: Feature\nDetails: The Current view now presents authored PRs, review requests, and assigned issues together. Counts remain visible while drilling into a teammate.\nBreaking Changes: None identified\nAffected Areas: Current view, people list, workload counts\n\nRecommendations\nCheck zero-count and high-count layouts at the smallest menu-bar window size.', 93600, '{"action":"closed","pr_number":51,"pr":{"number":51,"title":"Unify workload cards","html_url":"https://github.com/vercel/next.js/pull/80000","author":"priya-demo","head_ref":"feature/workload-cards","base_ref":"main"}}');
