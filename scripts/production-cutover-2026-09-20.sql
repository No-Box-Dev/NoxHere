UPDATE projects
   SET name = 'Nox', slug = 'nox', description = 'Nox platform and product services', updated_at = CURRENT_TIMESTAMP
 WHERE id = 'proj_no-box-dev_noxconnect' AND org_id = 2;

INSERT INTO project_routing_settings (org_id, project_id, enabled, updated_at)
VALUES (2, 'proj_no-box-dev_noxconnect', 1, CURRENT_TIMESTAMP)
ON CONFLICT(org_id, project_id) DO UPDATE SET enabled = 1, updated_at = CURRENT_TIMESTAMP;

UPDATE project_routing_settings
   SET enabled = 0, updated_at = CURRENT_TIMESTAMP
 WHERE org_id = 2 AND project_id NOT IN ('proj_no-box-dev_noxconnect', 'proj_no-box-dev_playnist');

INSERT INTO project_repositories (org_id, repo, project_id, updated_at)
SELECT 2, repo, 'proj_no-box-dev_noxconnect', CURRENT_TIMESTAMP
  FROM projects
 WHERE org_id = 2 AND archived = 0 AND repo IS NOT NULL
   AND id NOT IN ('proj_no-box-dev_playnist', 'proj_no-box-dev_playnist-ui')
ON CONFLICT(org_id, repo) DO UPDATE SET project_id = excluded.project_id, updated_at = CURRENT_TIMESTAMP;

INSERT INTO project_repositories (org_id, repo, project_id, updated_at)
SELECT 2, repo, 'proj_no-box-dev_playnist', CURRENT_TIMESTAMP
  FROM projects
 WHERE org_id = 2 AND archived = 0 AND repo IS NOT NULL
   AND id IN ('proj_no-box-dev_playnist', 'proj_no-box-dev_playnist-ui')
ON CONFLICT(org_id, repo) DO UPDATE SET project_id = excluded.project_id, updated_at = CURRENT_TIMESTAMP;

INSERT INTO projects
  (id, name, slug, org, repo, description, narrator_enabled, owner_id, org_id, archived, updated_at)
VALUES
  ('proj_n1healthcare_n1', 'N1 Healthcare', 'n1-healthcare', 'n1healthcare', 'n1website',
   'N1 Healthcare engineering projects', 1, 'n1healthcare', 1, 0, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, slug = excluded.slug, org = excluded.org, repo = excluded.repo,
  description = excluded.description, owner_id = excluded.owner_id, org_id = 1,
  archived = 0, updated_at = CURRENT_TIMESTAMP;

UPDATE project_routing_settings SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE org_id = 1;

INSERT INTO project_routing_settings (org_id, project_id, enabled, updated_at)
VALUES (1, 'proj_n1healthcare_n1', 1, CURRENT_TIMESTAMP)
ON CONFLICT(org_id, project_id) DO UPDATE SET enabled = 1, updated_at = CURRENT_TIMESTAMP;

INSERT INTO project_repositories (org_id, repo, project_id, updated_at)
SELECT 1, repo, 'proj_n1healthcare_n1', CURRENT_TIMESTAMP
  FROM projects
 WHERE org_id = 1 AND archived = 0 AND repo IS NOT NULL AND id != 'proj_n1healthcare_n1'
ON CONFLICT(org_id, repo) DO UPDATE SET project_id = excluded.project_id, updated_at = CURRENT_TIMESTAMP;
