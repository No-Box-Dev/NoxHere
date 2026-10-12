-- Replace the small illustrative fixture with an anonymized, N1-shaped
-- workspace. The proportions intentionally include uneven workloads, drafts,
-- review queues, multi-assignee issues, frequent merges, and dense timelines.
-- No names, titles, repositories, URLs, or payloads are copied from N1.

DELETE FROM events;
DELETE FROM pull_requests;
DELETE FROM issues;
DELETE FROM projects;
DELETE FROM actors;
DELETE FROM members;

INSERT INTO actors (id, name, github_login, avatar_url, kind) VALUES
  ('actor-reviewer', 'NoxFeed Reviewer', 'reviewer-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 'human'),
  ('actor-alex', 'Alex Morgan', 'alex-demo', 'https://avatars.githubusercontent.com/u/9919?v=4', 'human'),
  ('actor-priya', 'Priya Shah', 'priya-demo', 'https://avatars.githubusercontent.com/u/69631?v=4', 'human'),
  ('actor-sam', 'Sam Rivera', 'sam-demo', 'https://avatars.githubusercontent.com/u/810438?v=4', 'human'),
  ('actor-jordan', 'Jordan Lee', 'jordan-demo', 'https://avatars.githubusercontent.com/u/583231?v=4', 'human'),
  ('actor-mei', 'Mei Chen', 'mei-demo', 'https://avatars.githubusercontent.com/u/69631?v=4', 'human'),
  ('actor-taylor', 'Taylor Brooks', 'taylor-demo', NULL, 'human'),
  ('actor-devon', 'Devon Wright', 'devon-demo', NULL, 'human'),
  ('actor-nina', 'Nina Patel', 'nina-demo', NULL, 'human'),
  ('actor-omar', 'Omar Hassan', 'omar-demo', NULL, 'human'),
  ('actor-luca', 'Luca Rossi', 'luca-demo', NULL, 'human'),
  ('actor-ava', 'Ava Thompson', 'ava-demo', NULL, 'human');

INSERT INTO members (login, avatar_url, kind, sort_order)
SELECT github_login, avatar_url, kind,
  CASE github_login
    WHEN 'reviewer-demo' THEN 0 WHEN 'alex-demo' THEN 1 WHEN 'priya-demo' THEN 2
    WHEN 'sam-demo' THEN 3 WHEN 'jordan-demo' THEN 4 WHEN 'mei-demo' THEN 5
    WHEN 'taylor-demo' THEN 6 WHEN 'devon-demo' THEN 7 WHEN 'nina-demo' THEN 8
    WHEN 'omar-demo' THEN 9 WHEN 'luca-demo' THEN 10 ELSE 11 END
FROM actors;

INSERT INTO projects (id, name, slug, org, repo, archived) VALUES
  ('project-care-api', 'Care API', 'care-api', 'NoxFeed-Demo', 'care-api', 0),
  ('project-clinical', 'Clinical Workflows', 'clinical-workflows', 'NoxFeed-Demo', 'clinical-workflows', 0),
  ('project-patient', 'Patient Portal', 'patient-portal', 'NoxFeed-Demo', 'patient-portal', 0),
  ('project-mobile', 'Mobile App', 'mobile-app', 'NoxFeed-Demo', 'mobile-app', 0),
  ('project-identity', 'Identity Service', 'identity-service', 'NoxFeed-Demo', 'identity-service', 0),
  ('project-billing', 'Billing Service', 'billing-service', 'NoxFeed-Demo', 'billing-service', 0),
  ('project-ops', 'Care Operations', 'care-operations', 'NoxFeed-Demo', 'care-operations', 0),
  ('project-analytics', 'Health Analytics', 'health-analytics', 'NoxFeed-Demo', 'health-analytics', 0),
  ('project-data', 'Data Pipeline', 'data-pipeline', 'NoxFeed-Demo', 'data-pipeline', 0),
  ('project-platform', 'Platform Infrastructure', 'platform-infra', 'NoxFeed-Demo', 'platform-infra', 0),
  ('project-design', 'Design System', 'design-system', 'NoxFeed-Demo', 'design-system', 0),
  ('project-docs', 'Developer Documentation', 'developer-docs', 'NoxFeed-Demo', 'developer-docs', 0);

WITH RECURSIVE seq(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM seq WHERE i < 50),
open_rows AS (
  SELECT i,
    CASE i % 12
      WHEN 0 THEN 'care-api' WHEN 1 THEN 'clinical-workflows' WHEN 2 THEN 'patient-portal'
      WHEN 3 THEN 'mobile-app' WHEN 4 THEN 'identity-service' WHEN 5 THEN 'billing-service'
      WHEN 6 THEN 'care-operations' WHEN 7 THEN 'health-analytics' WHEN 8 THEN 'data-pipeline'
      WHEN 9 THEN 'platform-infra' WHEN 10 THEN 'design-system' ELSE 'developer-docs' END AS repo,
    CASE
      WHEN i <= 14 THEN 'alex-demo' WHEN i <= 23 THEN 'priya-demo'
      WHEN i <= 30 THEN 'sam-demo' WHEN i <= 35 THEN 'mei-demo'
      WHEN i <= 39 THEN 'jordan-demo' WHEN i <= 42 THEN 'reviewer-demo'
      WHEN i <= 45 THEN 'taylor-demo' WHEN i <= 47 THEN 'devon-demo'
      WHEN i = 48 THEN 'nina-demo' WHEN i = 49 THEN 'omar-demo' ELSE 'ava-demo' END AS author,
    CASE i % 10
      WHEN 0 THEN 'Add safe retry handling to the background queue'
      WHEN 1 THEN 'Simplify the care-plan review workflow'
      WHEN 2 THEN 'Improve validation for patient contact details'
      WHEN 3 THEN 'Reduce duplicate requests during app startup'
      WHEN 4 THEN 'Add audit context to permission changes'
      WHEN 5 THEN 'Make invoice reconciliation idempotent'
      WHEN 6 THEN 'Surface delayed tasks in the operations dashboard'
      WHEN 7 THEN 'Streamline weekly reporting calculations'
      WHEN 8 THEN 'Harden event ingestion against reordered deliveries'
      ELSE 'Polish shared loading and empty states' END AS title
  FROM seq
)
INSERT INTO pull_requests
  (id, repo, number, title, state, author, author_avatar, draft, head_ref,
   created_age_seconds, updated_age_seconds, html_url, merged_age_seconds, requested_reviewers_json)
SELECT
  1000 + i, repo, 100 + i, title || ' (' || i || ')', 'open', author,
  CASE author
    WHEN 'alex-demo' THEN 'https://avatars.githubusercontent.com/u/9919?v=4'
    WHEN 'priya-demo' THEN 'https://avatars.githubusercontent.com/u/69631?v=4'
    WHEN 'sam-demo' THEN 'https://avatars.githubusercontent.com/u/810438?v=4'
    ELSE NULL END,
  CASE WHEN i % 6 = 0 THEN 1 ELSE 0 END,
  'feature/demo-' || i,
  43200 + (i * 16200), 900 + (i * 2100),
  CASE i % 4
    WHEN 0 THEN 'https://github.com/swiftlang/swift/pull/82800'
    WHEN 1 THEN 'https://github.com/github/docs/pull/40000'
    WHEN 2 THEN 'https://github.com/vercel/next.js/pull/80000'
    ELSE 'https://github.com/cloudflare/workers-sdk/pull/10000' END,
  NULL,
  CASE WHEN i % 6 = 0 THEN '[]'
       WHEN i % 5 = 0 THEN json_array(json_object('login', 'reviewer-demo'), json_object('login', 'priya-demo'))
       ELSE json_array(json_object('login', CASE i % 6
         WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'priya-demo' WHEN 2 THEN 'sam-demo'
         WHEN 3 THEN 'jordan-demo' WHEN 4 THEN 'mei-demo' ELSE 'alex-demo' END)) END
FROM open_rows;

WITH RECURSIVE seq(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM seq WHERE i < 24),
merged_rows AS (
  SELECT i,
    CASE i % 12
      WHEN 0 THEN 'care-api' WHEN 1 THEN 'clinical-workflows' WHEN 2 THEN 'patient-portal'
      WHEN 3 THEN 'mobile-app' WHEN 4 THEN 'identity-service' WHEN 5 THEN 'billing-service'
      WHEN 6 THEN 'care-operations' WHEN 7 THEN 'health-analytics' WHEN 8 THEN 'data-pipeline'
      WHEN 9 THEN 'platform-infra' WHEN 10 THEN 'design-system' ELSE 'developer-docs' END AS repo,
    CASE i % 12
      WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'alex-demo' WHEN 2 THEN 'priya-demo'
      WHEN 3 THEN 'sam-demo' WHEN 4 THEN 'jordan-demo' WHEN 5 THEN 'mei-demo'
      WHEN 6 THEN 'taylor-demo' WHEN 7 THEN 'devon-demo' WHEN 8 THEN 'nina-demo'
      WHEN 9 THEN 'omar-demo' WHEN 10 THEN 'luca-demo' ELSE 'ava-demo' END AS author,
    CASE i % 8
      WHEN 0 THEN 'Ship batched notification delivery'
      WHEN 1 THEN 'Unify appointment status transitions'
      WHEN 2 THEN 'Cache frequently used organization settings'
      WHEN 3 THEN 'Add keyboard navigation to data tables'
      WHEN 4 THEN 'Protect refresh tokens during concurrent renewal'
      WHEN 5 THEN 'Improve reconciliation metrics and alerts'
      WHEN 6 THEN 'Move repeated form controls into the design system'
      ELSE 'Document the production rollout checklist' END AS title
  FROM seq
)
INSERT INTO pull_requests
  (id, repo, number, title, state, author, author_avatar, draft, head_ref,
   created_age_seconds, updated_age_seconds, html_url, merged_age_seconds, requested_reviewers_json)
SELECT
  2000 + i, repo, 300 + i, title || ' (' || i || ')', 'merged', author, NULL, 0,
  'shipped/demo-' || i, 259200 + (i * 21600), 7200 + (i * 10800),
  CASE i % 4
    WHEN 0 THEN 'https://github.com/swiftlang/swift/pull/82700'
    WHEN 1 THEN 'https://github.com/github/docs/pull/39900'
    WHEN 2 THEN 'https://github.com/vercel/next.js/pull/79900'
    ELSE 'https://github.com/cloudflare/workers-sdk/pull/10000' END,
  7200 + (i * 10800),
  json_array(json_object('login', CASE i % 5
    WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'alex-demo' WHEN 2 THEN 'priya-demo'
    WHEN 3 THEN 'sam-demo' ELSE 'mei-demo' END))
FROM merged_rows;

WITH RECURSIVE seq(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM seq WHERE i < 72),
issue_rows AS (
  SELECT i,
    CASE i % 12
      WHEN 0 THEN 'care-api' WHEN 1 THEN 'clinical-workflows' WHEN 2 THEN 'patient-portal'
      WHEN 3 THEN 'mobile-app' WHEN 4 THEN 'identity-service' WHEN 5 THEN 'billing-service'
      WHEN 6 THEN 'care-operations' WHEN 7 THEN 'health-analytics' WHEN 8 THEN 'data-pipeline'
      WHEN 9 THEN 'platform-infra' WHEN 10 THEN 'design-system' ELSE 'developer-docs' END AS repo,
    CASE
      WHEN i <= 16 THEN 'alex-demo' WHEN i <= 28 THEN 'priya-demo'
      WHEN i <= 38 THEN 'sam-demo' WHEN i <= 46 THEN 'reviewer-demo'
      WHEN i <= 52 THEN 'mei-demo' WHEN i <= 57 THEN 'jordan-demo'
      WHEN i <= 61 THEN 'taylor-demo' WHEN i <= 64 THEN 'devon-demo'
      WHEN i <= 67 THEN 'nina-demo' WHEN i <= 69 THEN 'omar-demo'
      WHEN i <= 71 THEN 'luca-demo' ELSE 'ava-demo' END AS assignee,
    CASE i % 9
      WHEN 0 THEN 'Investigate intermittent webhook delivery delay'
      WHEN 1 THEN 'Clarify the empty state for new organizations'
      WHEN 2 THEN 'Add coverage for timezone boundary conditions'
      WHEN 3 THEN 'Reduce visual noise in the patient summary'
      WHEN 4 THEN 'Document recovery steps for failed imports'
      WHEN 5 THEN 'Expose queue latency in service health'
      WHEN 6 THEN 'Retain filters when returning from a detail view'
      WHEN 7 THEN 'Improve accessibility labels for status controls'
      ELSE 'Audit slow queries in the weekly report' END AS title
  FROM seq
)
INSERT INTO issues
  (id, repo, number, title, state, author, author_avatar, created_age_seconds,
   updated_age_seconds, html_url, assignees_json, labels_json)
SELECT
  3000 + i, repo, 500 + i, title || ' (' || i || ')', 'open',
  CASE i % 4 WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'jordan-demo'
       WHEN 2 THEN 'mei-demo' ELSE 'taylor-demo' END,
  NULL, 86400 + (i * 10800), 3600 + (i * 2400),
  CASE i % 3
    WHEN 0 THEN 'https://github.com/swiftlang/swift/issues/80000'
    WHEN 1 THEN 'https://github.com/github/docs/issues/39000'
    ELSE 'https://github.com/vercel/next.js/issues/79000' END,
  CASE WHEN i % 10 = 0 THEN json_array(assignee, 'reviewer-demo') ELSE json_array(assignee) END,
  CASE i % 5
    WHEN 0 THEN '["bug","priority:high"]' WHEN 1 THEN '["documentation"]'
    WHEN 2 THEN '["accessibility","frontend"]' WHEN 3 THEN '["observability","backend"]'
    ELSE '["enhancement"]' END
FROM issue_rows;

-- Opened feed: first-person summaries for all open pull requests.
INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT
  600000 + (2000 - p.id), 'pr_narrative', 'pr_narrative', 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number,
  CASE p.number % 6
    WHEN 0 THEN 'I tightened the failure path and added enough context to diagnose retries without opening the logs.'
    WHEN 1 THEN 'I simplified this workflow so the common path is faster while the edge cases remain explicit.'
    WHEN 2 THEN 'I moved validation closer to the boundary and added coverage for malformed and partial input.'
    WHEN 3 THEN 'I removed duplicate requests during startup and kept the loading state stable during refresh.'
    WHEN 4 THEN 'I added audit context around permission changes so administrators can understand every transition.'
    ELSE 'I consolidated the repeated UI states and kept the existing behavior intact across the product.' END,
  p.updated_age_seconds,
  json_object('action', 'opened', 'trigger_type', 'github:pr:opened', 'pr_number', p.number,
    'pr', json_object('number', p.number, 'title', p.title, 'html_url', p.html_url,
      'author', p.author, 'body', 'This change includes implementation, tests, rollout notes, and explicit handling for failure states.',
      'head_ref', p.head_ref, 'base_ref', 'main', 'additions', 40 + (p.number % 380),
      'deletions', 8 + (p.number % 90), 'changed_files', 2 + (p.number % 16), 'draft', json(p.draft)))
FROM pull_requests p WHERE p.state = 'open';

-- Merged feed and release notes: paired rows for every recent merge.
INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT
  700000 + (3000 - p.id), 'narrative', 'narrative', 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number,
  CASE p.number % 5
    WHEN 0 THEN 'I shipped safer queue processing with bounded retries and clearer operational signals.'
    WHEN 1 THEN 'I unified the status transition path and removed several sources of inconsistent state.'
    WHEN 2 THEN 'I reduced repeated configuration reads while preserving immediate updates for administrators.'
    WHEN 3 THEN 'I added complete keyboard navigation and improved focus behavior throughout the table.'
    ELSE 'I hardened token renewal against concurrent requests and wake-from-sleep races.' END,
  p.merged_age_seconds,
  json_object('action', 'closed', 'trigger_type', 'github:pr:merged', 'pr_number', p.number,
    'pr', json_object('number', p.number, 'title', p.title, 'html_url', p.html_url,
      'author', p.author, 'head_ref', p.head_ref, 'base_ref', 'main',
      'additions', 60 + (p.number % 420), 'deletions', 10 + (p.number % 120),
      'changed_files', 3 + (p.number % 18)))
FROM pull_requests p WHERE p.state = 'merged';

INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT
  800000 + (3000 - p.id), 'release_notes', 'release_notes', 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number,
  '✅ ' || p.repo || ' #' || p.number || ' Shipped - Product improvement\n' ||
  'Repository: ' || p.repo || '\nPull Request: #' || p.number || ' - ' || p.title || '\n' ||
  'Author: ' || p.author || ' | Branch: ' || p.head_ref || ' → main\n\n' ||
  'Change Summary\nType: Product improvement\n' ||
  'Details: The change is live with validation, failure handling, metrics, and regression coverage.\n' ||
  'Breaking Changes: None identified\nAffected Areas: application workflow, API behavior, monitoring\n\n' ||
  'Recommendations\nWatch the relevant service metrics during the first production hour and verify the primary workflow.',
  p.merged_age_seconds,
  json_object('action', 'closed', 'trigger_type', 'github:pr:merged', 'pr_number', p.number,
    'pr', json_object('number', p.number, 'title', p.title, 'html_url', p.html_url,
      'author', p.author, 'head_ref', p.head_ref, 'base_ref', 'main'))
FROM pull_requests p WHERE p.state = 'merged';

-- Dense, production-shaped timelines. Every PR has an open, push, and review
-- event; non-drafts may be approved; merged PRs also have a merge event.
INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT 100000 + p.id, 'github:pr:opened', NULL, 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number, p.title, p.created_age_seconds,
  json_object('action', 'opened', 'pr', json_object('number', p.number, 'title', p.title,
    'html_url', p.html_url, 'author', p.author,
    'body', 'Includes the implementation plan, test coverage, and rollout considerations.',
    'head_ref', p.head_ref, 'base_ref', 'main', 'additions', 40 + (p.number % 380),
    'deletions', 8 + (p.number % 90), 'changed_files', 2 + (p.number % 16), 'draft', json(p.draft)))
FROM pull_requests p;

INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT 200000 + p.id, 'github:push', NULL, 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number, 'Address review feedback and extend regression coverage',
  CASE WHEN p.state = 'merged' THEN p.merged_age_seconds + 7200 ELSE p.updated_age_seconds + 7200 END,
  json_object('ref', 'refs/heads/' || p.head_ref, 'pusher', p.author,
    'commits', json_array(json_object('message', 'Address review feedback'),
                          json_object('message', 'Extend regression coverage')))
FROM pull_requests p;

INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT 300000 + p.id, 'github:pr:review:commented', NULL, 'github',
  'actor-' || replace(CASE p.number % 5 WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'priya-demo'
    WHEN 2 THEN 'sam-demo' WHEN 3 THEN 'mei-demo' ELSE 'alex-demo' END, '-demo', ''),
  'project-' || p.repo, 'NoxFeed-Demo', p.repo, p.number,
  'Review feedback on tests, failure handling, and rollout clarity',
  CASE WHEN p.state = 'merged' THEN p.merged_age_seconds + 3600 ELSE p.updated_age_seconds + 3600 END,
  json_object('action', 'submitted', 'pr', json_object('number', p.number, 'title', p.title,
    'html_url', p.html_url, 'author', p.author),
    'review', json_object('state', 'commented',
      'author', CASE p.number % 5 WHEN 0 THEN 'reviewer-demo' WHEN 1 THEN 'priya-demo'
        WHEN 2 THEN 'sam-demo' WHEN 3 THEN 'mei-demo' ELSE 'alex-demo' END,
      'body', 'The direction looks good. Please make the failure state explicit and add one regression case for the boundary condition.'))
FROM pull_requests p WHERE p.draft = 0;

INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT 400000 + p.id, 'github:pr:review:approved', NULL, 'github', 'actor-reviewer',
  'project-' || p.repo, 'NoxFeed-Demo', p.repo, p.number, 'Approved after follow-up changes',
  CASE WHEN p.state = 'merged' THEN p.merged_age_seconds + 1200 ELSE p.updated_age_seconds + 1200 END,
  json_object('action', 'submitted', 'pr', json_object('number', p.number, 'title', p.title,
    'html_url', p.html_url, 'author', p.author),
    'review', json_object('state', 'approved', 'author', 'reviewer-demo',
      'body', 'The follow-up covers the edge case and the rollout path is clear.'))
FROM pull_requests p WHERE p.draft = 0 AND p.number % 2 = 0;

INSERT INTO events
  (id, type, feed_mode, source, actor_id, project_id, org, repo, pr_number, summary, age_seconds, payload_json)
SELECT 500000 + p.id, 'github:pr:merged', NULL, 'github',
  'actor-' || replace(p.author, '-demo', ''), 'project-' || p.repo,
  'NoxFeed-Demo', p.repo, p.number, p.title, p.merged_age_seconds,
  json_object('action', 'closed', 'pr', json_object('number', p.number, 'title', p.title,
    'html_url', p.html_url, 'author', p.author, 'head_ref', p.head_ref, 'base_ref', 'main',
    'additions', 60 + (p.number % 420), 'deletions', 10 + (p.number % 120),
    'changed_files', 3 + (p.number % 18)))
FROM pull_requests p WHERE p.state = 'merged';
