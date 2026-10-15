-- The N1 capture sites predate the umbrella project and still point at the
-- generated single-repository projects. Move canonical ownership and the
-- project-scoped records in the baseline schema together, but only when N1 explicitly
-- owns the site's repository in the central routing map.
INSERT OR IGNORE INTO feedback_config_audit
  (id, org_id, project_id, site_id, actor_login, action, changes_json)
SELECT
  'migration:0114:' || site.id,
  site.org_id,
  'proj_n1healthcare_n1',
  site.id,
  'migration:noxspot',
  'site.migrated',
  json_object('previousProjectId', site.project_id, 'projectId', 'proj_n1healthcare_n1')
FROM spot_sites site
JOIN projects target
  ON target.id = 'proj_n1healthcare_n1'
 AND target.org_id = site.org_id
 AND COALESCE(target.archived, 0) = 0
JOIN project_repositories assignment
  ON assignment.org_id = site.org_id
 AND assignment.project_id = target.id
 AND assignment.repo = site.repo COLLATE NOCASE
WHERE site.project_id IN (
  'proj_n1healthcare_react-frontend',
  'proj_n1healthcare_n1website'
);

UPDATE spot_reports
   SET project_id = 'proj_n1healthcare_n1',
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE site_id IN (
   SELECT site.id
     FROM spot_sites site
     JOIN project_repositories assignment
       ON assignment.org_id = site.org_id
      AND assignment.project_id = 'proj_n1healthcare_n1'
      AND assignment.repo = site.repo COLLATE NOCASE
    WHERE site.project_id IN ('proj_n1healthcare_react-frontend', 'proj_n1healthcare_n1website')
 );

UPDATE delivery_outbox
   SET project_id = 'proj_n1healthcare_n1',
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE site_id IN (
   SELECT site.id
     FROM spot_sites site
     JOIN project_repositories assignment
       ON assignment.org_id = site.org_id
      AND assignment.project_id = 'proj_n1healthcare_n1'
      AND assignment.repo = site.repo COLLATE NOCASE
    WHERE site.project_id IN ('proj_n1healthcare_react-frontend', 'proj_n1healthcare_n1website')
 );

UPDATE spot_sites
   SET project_id = 'proj_n1healthcare_n1',
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE id IN (
   SELECT site.id
     FROM spot_sites site
     JOIN project_repositories assignment
       ON assignment.org_id = site.org_id
      AND assignment.project_id = 'proj_n1healthcare_n1'
      AND assignment.repo = site.repo COLLATE NOCASE
    WHERE site.project_id IN ('proj_n1healthcare_react-frontend', 'proj_n1healthcare_n1website')
 );
