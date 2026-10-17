-- Migration 0067 imported the original NoxFeed destinations with their
-- historical route keys. Activity delivery now resolves only the canonical
-- capability names, so preserve each destination under the current key before
-- removing the obsolete alias.
INSERT OR IGNORE INTO project_slack_routes
  (org_id, project_id, route_key, connection_id, channel_id, updated_at)
SELECT org_id, project_id,
       CASE route_key
         WHEN 'noxfeed_posts' THEN 'activity_posts'
         WHEN 'noxfeed_release_notes' THEN 'activity_release_notes'
       END,
       connection_id, channel_id, updated_at
  FROM project_slack_routes
 WHERE route_key IN ('noxfeed_posts', 'noxfeed_release_notes');

DELETE FROM project_slack_routes
 WHERE route_key IN ('noxfeed_posts', 'noxfeed_release_notes')
   AND EXISTS (
     SELECT 1
       FROM project_slack_routes canonical
      WHERE canonical.org_id = project_slack_routes.org_id
        AND canonical.project_id = project_slack_routes.project_id
        AND canonical.route_key = CASE project_slack_routes.route_key
          WHEN 'noxfeed_posts' THEN 'activity_posts'
          WHEN 'noxfeed_release_notes' THEN 'activity_release_notes'
        END
   );
