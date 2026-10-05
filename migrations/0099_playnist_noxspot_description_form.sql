-- NoxSpot's standard report form is a single required description. Existing
-- custom forms remain untouched; Playnist explicitly requested the standard.
INSERT OR IGNORE INTO noxspot_config_audit
  (id, org_id, project_id, site_id, actor_login, action, changes_json)
SELECT
  'migration:0099:' || site.id,
  site.org_id,
  site.project_id,
  site.id,
  'migration:noxspot',
  'site.updated',
  '{"blocks":[{"id":"default-description","type":"description","label":"Description","required":true}]}'
FROM spot_sites site
JOIN projects project ON project.id = site.project_id AND project.org_id = site.org_id
WHERE lower(project.name) = 'playnist';

UPDATE spot_sites
SET widget_config = json_set(
      CASE WHEN json_valid(widget_config) THEN widget_config ELSE '{}' END,
      '$.blocks',
      json('[{"id":"default-description","type":"description","label":"Description","required":true}]')
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE project_id IN (
  SELECT id FROM projects WHERE lower(name) = 'playnist'
);
