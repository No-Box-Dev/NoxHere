ALTER TABLE noxspot_config_audit RENAME TO feedback_config_audit;

DROP INDEX IF EXISTS idx_noxspot_config_audit_org_created;
DROP INDEX IF EXISTS idx_noxspot_config_audit_site_created;
DROP INDEX IF EXISTS idx_noxspot_config_audit_project;

CREATE INDEX idx_feedback_config_audit_org_created
  ON feedback_config_audit(org_id, created_at DESC);
CREATE INDEX idx_feedback_config_audit_site_created
  ON feedback_config_audit(site_id, created_at DESC);
CREATE INDEX idx_feedback_config_audit_project
  ON feedback_config_audit(org_id, project_id, created_at DESC);
