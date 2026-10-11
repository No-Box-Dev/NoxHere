-- Restore the complete feedback form after migration 0099 replaced every
-- Playnist site's custom blocks with a single description. NoxHere previously
-- relied on an empty-list client fallback; persist the same explicit contract
-- so cache/version combinations cannot silently change its form again.

INSERT OR IGNORE INTO noxspot_config_audit
  (id, org_id, project_id, site_id, actor_login, action, changes_json)
SELECT
  'migration:0107:' || site.id,
  site.org_id,
  site.project_id,
  site.id,
  'migration:noxspot',
  'site.updated',
  '{"blocks":"restored-complete-feedback-form"}'
FROM spot_sites site
WHERE site.id IN (
  '73efde30-8c43-4e69-9ea9-3c06b5ca6185',
  '8970ca4d-75ad-41d0-a5fa-e4e62e658635'
)
  AND json_valid(site.widget_config)
  AND (
    (site.id = '73efde30-8c43-4e69-9ea9-3c06b5ca6185'
      AND json_array_length(json_extract(site.widget_config, '$.blocks')) = 1
      AND json_extract(site.widget_config, '$.blocks[0].type') = 'description')
    OR
    (site.id = '8970ca4d-75ad-41d0-a5fa-e4e62e658635'
      AND json_array_length(json_extract(site.widget_config, '$.blocks')) = 0)
  );

UPDATE spot_sites
SET widget_config = json_set(
      CASE WHEN json_valid(widget_config) THEN widget_config ELSE '{}' END,
      '$.blocks',
      json('[
        {"id":"default-title","type":"title","label":"Title","required":true},
        {"id":"default-description","type":"description","label":"Description","required":true},
        {"id":"default-reporter","type":"reporter","label":"Submitted by","required":true},
        {"id":"default-contact-email","type":"contact_email","label":"Contact email (optional)","required":false},
        {"id":"default-category","type":"category","label":"Category","required":false},
        {"id":"default-element-picker","type":"element_picker","required":false},
        {"id":"default-metadata","type":"metadata","required":false},
        {"id":"default-console-logs","type":"console_logs","required":false}
      ]')
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE id = '73efde30-8c43-4e69-9ea9-3c06b5ca6185'
  AND json_valid(widget_config)
  AND json_array_length(json_extract(widget_config, '$.blocks')) = 1
  AND json_extract(widget_config, '$.blocks[0].type') = 'description';

UPDATE spot_sites
SET widget_config = json_set(
      CASE WHEN json_valid(widget_config) THEN widget_config ELSE '{}' END,
      '$.blocks',
      json('[
        {"id":"default-title","type":"title","label":"Title","required":true},
        {"id":"default-description","type":"description","label":"Description","required":true},
        {"id":"default-reporter","type":"reporter","label":"Submitted by","required":true},
        {"id":"default-contact-email","type":"contact_email","label":"Contact email (optional)","required":false},
        {"id":"default-category","type":"category","label":"Category","required":false},
        {"id":"default-element-picker","type":"element_picker","required":false},
        {"id":"default-metadata","type":"metadata","required":false},
        {"id":"default-console-logs","type":"console_logs","required":false}
      ]')
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE id = '8970ca4d-75ad-41d0-a5fa-e4e62e658635'
  AND json_valid(widget_config)
  AND json_array_length(json_extract(widget_config, '$.blocks')) = 0;
