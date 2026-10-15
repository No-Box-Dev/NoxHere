-- Preserve incident Slack destinations created before capability route names
-- were unified. Runtime routing now uses telemetry/telemetry_alerts, while
-- older organizations may still hold noxcue/noxcue_alerts rows.
INSERT OR IGNORE INTO project_slack_routes
  (org_id, project_id, route_key, connection_id, channel_id, updated_at)
SELECT org_id, project_id,
       CASE route_key
         WHEN 'noxcue' THEN 'telemetry'
         WHEN 'noxcue_alerts' THEN 'telemetry_alerts'
       END,
       connection_id, channel_id, updated_at
  FROM project_slack_routes
 WHERE route_key IN ('noxcue', 'noxcue_alerts');

DELETE FROM project_slack_routes
 WHERE route_key IN ('noxcue', 'noxcue_alerts')
   AND EXISTS (
     SELECT 1
       FROM project_slack_routes canonical
      WHERE canonical.project_id = project_slack_routes.project_id
        AND canonical.route_key = CASE project_slack_routes.route_key
          WHEN 'noxcue' THEN 'telemetry'
          WHEN 'noxcue_alerts' THEN 'telemetry_alerts'
        END
   );
