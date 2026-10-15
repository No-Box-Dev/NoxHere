-- Move active capability storage from retired product namespaces to the
-- unified NoxHere capability names. Historical migrations remain immutable;
-- this migration preserves every row and lets SQLite rewrite foreign keys to
-- the renamed parent tables.

ALTER TABLE cue_sources RENAME TO telemetry_sources;
ALTER TABLE cue_metric_definitions RENAME TO telemetry_metric_definitions;
ALTER TABLE cue_error_groups RENAME TO telemetry_error_groups;
ALTER TABLE cue_github_incidents RENAME TO telemetry_github_incidents;

ALTER TABLE cue_activity_events RENAME TO telemetry_activity_events;
ALTER TABLE cue_chart_snapshots RENAME TO telemetry_chart_snapshots;
ALTER TABLE cue_custom_features RENAME TO telemetry_custom_features;
ALTER TABLE cue_custom_metrics RENAME TO telemetry_custom_metrics;
ALTER TABLE cue_daily_metrics RENAME TO telemetry_daily_metrics;
ALTER TABLE cue_digest_runs RENAME TO telemetry_digest_runs;
ALTER TABLE cue_endpoint_monitors RENAME TO telemetry_endpoint_monitors;
ALTER TABLE cue_engagement_settings RENAME TO telemetry_engagement_settings;
ALTER TABLE cue_error_daily_groups RENAME TO telemetry_error_daily_groups;
ALTER TABLE cue_error_daily_users RENAME TO telemetry_error_daily_users;
ALTER TABLE cue_error_group_users RENAME TO telemetry_error_group_users;
ALTER TABLE cue_error_receipts RENAME TO telemetry_error_receipts;
ALTER TABLE cue_feature_results RENAME TO telemetry_feature_results;
ALTER TABLE cue_feature_states RENAME TO telemetry_feature_states;
ALTER TABLE cue_github_issue_links RENAME TO telemetry_github_issue_links;
ALTER TABLE cue_github_issue_settings RENAME TO telemetry_github_issue_settings;
ALTER TABLE cue_project_metric_settings RENAME TO telemetry_project_metric_settings;
ALTER TABLE cue_source_audit RENAME TO telemetry_source_audit;
ALTER TABLE cue_source_card_settings RENAME TO telemetry_source_card_settings;
ALTER TABLE cue_source_key_audit RENAME TO telemetry_source_key_audit;
ALTER TABLE cue_source_key_daily_usage RENAME TO telemetry_source_key_daily_usage;
ALTER TABLE cue_source_keys RENAME TO telemetry_source_keys;
ALTER TABLE cue_tracked_events RENAME TO telemetry_tracked_events;
ALTER TABLE cue_user_active_days RENAME TO telemetry_user_active_days;
ALTER TABLE cue_user_registrations RENAME TO telemetry_user_registrations;

-- Keep generated idempotency identifiers aligned with the new runtime prefix.
-- The hash suffix is unchanged, so retries continue to resolve to the same row.
UPDATE telemetry_activity_events
   SET event_id = 'telemetry_' || substr(event_id, 5)
 WHERE event_id LIKE 'cue_%';
UPDATE telemetry_error_receipts
   SET event_id = 'telemetry_' || substr(event_id, 5)
 WHERE event_id LIKE 'cue_%';
UPDATE telemetry_feature_results
   SET event_id = 'telemetry_' || substr(event_id, 5)
 WHERE event_id LIKE 'cue_%';
UPDATE telemetry_tracked_events
   SET event_id = 'telemetry_' || substr(event_id, 5)
 WHERE event_id LIKE 'cue_%';

-- These superseded Activity routing tables are retained for audit/recovery,
-- but their names now make both ownership and legacy status explicit.
DROP TRIGGER IF EXISTS noxfeed_routes_clear_deleted_slack_connection;
ALTER TABLE noxfeed_project_repositories RENAME TO activity_archived_project_repositories;
ALTER TABLE noxfeed_project_routes RENAME TO activity_archived_project_routes;

-- Preserve lifecycle facts stranded in the two retired Telemetry tables.
INSERT INTO telemetry_app_user_activity
  (app_id, github_login, registered_at, last_active_period, last_event_at)
SELECT CASE app_id WHEN 'noxconnect' THEN 'noxhere' ELSE 'activity' END,
       github_login, registered_at, last_active_period, last_event_at
  FROM noxcue_app_user_activity
 WHERE 1
ON CONFLICT(app_id, github_login) DO UPDATE SET
  registered_at = min(telemetry_app_user_activity.registered_at, excluded.registered_at),
  last_active_period = max(telemetry_app_user_activity.last_active_period, excluded.last_active_period),
  last_event_at = max(telemetry_app_user_activity.last_event_at, excluded.last_event_at);

INSERT INTO telemetry_app_user_activity
  (app_id, github_login, registered_at, last_active_period, last_event_at)
SELECT 'noxhere', github_login, registered_at, last_active_period, last_event_at
  FROM noxcue_self_user_activity
 WHERE 1
ON CONFLICT(app_id, github_login) DO UPDATE SET
  registered_at = min(telemetry_app_user_activity.registered_at, excluded.registered_at),
  last_active_period = max(telemetry_app_user_activity.last_active_period, excluded.last_active_period),
  last_event_at = max(telemetry_app_user_activity.last_event_at, excluded.last_event_at);

DROP TABLE noxcue_self_user_activity;
DROP TABLE noxcue_app_user_activity;

-- Explicit index names are not changed by ALTER TABLE. Recreate them under
-- the capability namespace while retaining their definitions exactly.
DROP INDEX idx_cue_activity_events_metric_period;
CREATE INDEX idx_telemetry_activity_events_metric_period
  ON telemetry_activity_events(source_id, metric_key, period);
DROP INDEX idx_cue_activity_events_source_occurred;
CREATE INDEX idx_telemetry_activity_events_source_occurred
  ON telemetry_activity_events(source_id, occurred_at DESC);
DROP INDEX idx_cue_chart_snapshots_expires_at;
CREATE INDEX idx_telemetry_chart_snapshots_expires_at
  ON telemetry_chart_snapshots(expires_at);
DROP INDEX idx_cue_custom_features_org;
CREATE INDEX idx_telemetry_custom_features_org
  ON telemetry_custom_features(org_id, enabled, feature_key);
DROP INDEX idx_cue_custom_features_project_key;
CREATE UNIQUE INDEX idx_telemetry_custom_features_project_key
  ON telemetry_custom_features(project_id, feature_key) WHERE project_id IS NOT NULL;
DROP INDEX idx_cue_custom_features_source_key;
CREATE UNIQUE INDEX idx_telemetry_custom_features_source_key
  ON telemetry_custom_features(source_id, feature_key) WHERE source_id IS NOT NULL;
DROP INDEX idx_cue_custom_metrics_project_key;
CREATE UNIQUE INDEX idx_telemetry_custom_metrics_project_key
  ON telemetry_custom_metrics(project_id, metric_key) WHERE project_id IS NOT NULL;
DROP INDEX idx_cue_custom_metrics_project_template_slot;
CREATE UNIQUE INDEX idx_telemetry_custom_metrics_project_template_slot
  ON telemetry_custom_metrics(project_id, template_slot)
  WHERE project_id IS NOT NULL AND template_slot IS NOT NULL;
DROP INDEX idx_cue_custom_metrics_source_key;
CREATE UNIQUE INDEX idx_telemetry_custom_metrics_source_key
  ON telemetry_custom_metrics(source_id, metric_key) WHERE source_id IS NOT NULL;
DROP INDEX idx_cue_daily_metrics_org_period;
CREATE INDEX idx_telemetry_daily_metrics_org_period
  ON telemetry_daily_metrics(org_id, period DESC, source_id, metric_key);
DROP INDEX idx_cue_daily_metrics_source_key_period;
CREATE INDEX idx_telemetry_daily_metrics_source_key_period
  ON telemetry_daily_metrics(source_id, metric_key, period DESC);
DROP INDEX idx_cue_digest_runs_org_period;
CREATE INDEX idx_telemetry_digest_runs_org_period
  ON telemetry_digest_runs(org_id, period DESC, source_id);
DROP INDEX idx_cue_digest_runs_transport_outbox;
CREATE INDEX idx_telemetry_digest_runs_transport_outbox
  ON telemetry_digest_runs(transport_outbox_id);
DROP INDEX idx_cue_error_daily_groups_org_period;
CREATE INDEX idx_telemetry_error_daily_groups_org_period
  ON telemetry_error_daily_groups(org_id, period DESC, source_id);
DROP INDEX idx_cue_error_daily_users_org_period;
CREATE INDEX idx_telemetry_error_daily_users_org_period
  ON telemetry_error_daily_users(org_id, period DESC, source_id);
DROP INDEX idx_cue_error_group_users_group;
CREATE INDEX idx_telemetry_error_group_users_group
  ON telemetry_error_group_users(source_id, fingerprint);
DROP INDEX idx_cue_error_groups_org_last_seen;
CREATE INDEX idx_telemetry_error_groups_org_last_seen
  ON telemetry_error_groups(org_id, last_seen_at DESC);
DROP INDEX idx_cue_error_groups_org_status_last_seen;
CREATE INDEX idx_telemetry_error_groups_org_status_last_seen
  ON telemetry_error_groups(org_id, status, last_seen_at DESC);
DROP INDEX idx_cue_error_receipts_expiry;
CREATE INDEX idx_telemetry_error_receipts_expiry
  ON telemetry_error_receipts(expires_at);
DROP INDEX idx_cue_feature_results_retention;
CREATE INDEX idx_telemetry_feature_results_retention
  ON telemetry_feature_results(received_at);
DROP INDEX idx_cue_feature_results_source_subject_time;
CREATE INDEX idx_telemetry_feature_results_source_subject_time
  ON telemetry_feature_results(source_id, subject_hash, received_at DESC)
  WHERE subject_hash IS NOT NULL;
DROP INDEX idx_cue_feature_results_source_time;
CREATE INDEX idx_telemetry_feature_results_source_time
  ON telemetry_feature_results(source_id, feature_key, received_at DESC);
DROP INDEX idx_cue_feature_states_org_status;
CREATE INDEX idx_telemetry_feature_states_org_status
  ON telemetry_feature_states(org_id, status, updated_at DESC);
DROP INDEX idx_cue_github_incidents_pending;
CREATE INDEX idx_telemetry_github_incidents_pending
  ON telemetry_github_incidents(status, updated_at);
DROP INDEX idx_cue_github_incidents_project;
CREATE INDEX idx_telemetry_github_incidents_project
  ON telemetry_github_incidents(org_id, project_id, last_seen_at DESC);
DROP INDEX idx_cue_project_metric_settings_org;
CREATE INDEX idx_telemetry_project_metric_settings_org
  ON telemetry_project_metric_settings(org_id, project_id, enabled, metric_key);
DROP INDEX idx_cue_source_audit_source;
CREATE INDEX idx_telemetry_source_audit_source
  ON telemetry_source_audit(org_id, source_id, created_at DESC);
DROP INDEX idx_cue_source_key_audit_source;
CREATE INDEX idx_telemetry_source_key_audit_source
  ON telemetry_source_key_audit(source_id, created_at DESC);
DROP INDEX idx_cue_source_keys_source;
CREATE INDEX idx_telemetry_source_keys_source
  ON telemetry_source_keys(org_id, source_id, revoked_at);
DROP INDEX idx_cue_sources_org;
CREATE INDEX idx_telemetry_sources_org
  ON telemetry_sources(org_id, enabled, created_at DESC);
DROP INDEX idx_cue_sources_project;
CREATE INDEX idx_telemetry_sources_project
  ON telemetry_sources(org_id, project_id, id);
DROP INDEX idx_cue_sources_slack_connection;
CREATE INDEX idx_telemetry_sources_slack_connection
  ON telemetry_sources(org_id, slack_connection_id);
DROP INDEX idx_cue_tracked_events_period;
CREATE INDEX idx_telemetry_tracked_events_period
  ON telemetry_tracked_events(source_id, period, name, subject_hash);
DROP INDEX idx_cue_tracked_events_subject;
CREATE INDEX idx_telemetry_tracked_events_subject
  ON telemetry_tracked_events(source_id, subject_hash, name, occurred_at)
  WHERE subject_hash IS NOT NULL;
DROP INDEX idx_cue_user_active_days_source_occurred;
CREATE INDEX idx_telemetry_user_active_days_source_occurred
  ON telemetry_user_active_days(source_id, occurred_at DESC);
DROP INDEX idx_cue_user_active_days_source_period_subject;
CREATE INDEX idx_telemetry_user_active_days_source_period_subject
  ON telemetry_user_active_days(source_id, period, subject_hash);
DROP INDEX idx_cue_user_active_days_source_subject_period;
CREATE INDEX idx_telemetry_user_active_days_source_subject_period
  ON telemetry_user_active_days(source_id, subject_hash, period);
DROP INDEX idx_cue_user_registrations_source_occurred;
CREATE INDEX idx_telemetry_user_registrations_source_occurred
  ON telemetry_user_registrations(source_id, occurred_at DESC);
DROP INDEX idx_cue_user_registrations_source_period;
CREATE INDEX idx_telemetry_user_registrations_source_period
  ON telemetry_user_registrations(source_id, period, subject_hash);

DROP INDEX idx_noxfeed_project_repositories_project;
CREATE INDEX idx_activity_archived_project_repositories_project
  ON activity_archived_project_repositories(project_id);
DROP INDEX idx_noxfeed_project_routes_org;
CREATE INDEX idx_activity_archived_project_routes_org
  ON activity_archived_project_routes(org_id);

CREATE TRIGGER activity_archived_routes_clear_deleted_slack_connection
BEFORE DELETE ON slack_connections
BEGIN
  UPDATE activity_archived_project_routes
     SET posts_connection_id = NULL,
         posts_channel_id = NULL,
         updated_at = CURRENT_TIMESTAMP
   WHERE posts_connection_id = OLD.id;
  UPDATE activity_archived_project_routes
     SET release_notes_connection_id = NULL,
         release_notes_channel_id = NULL,
         updated_at = CURRENT_TIMESTAMP
   WHERE release_notes_connection_id = OLD.id;
END;
