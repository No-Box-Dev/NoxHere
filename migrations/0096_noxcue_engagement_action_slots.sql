-- The standard engagement template promotes up to three custom activities.
-- Custom metrics without a slot remain available as advanced metrics.
ALTER TABLE cue_custom_metrics
  ADD COLUMN template_slot INTEGER CHECK (template_slot BETWEEN 1 AND 3);

CREATE UNIQUE INDEX idx_cue_custom_metrics_project_template_slot
  ON cue_custom_metrics(project_id, template_slot)
  WHERE project_id IS NOT NULL AND template_slot IS NOT NULL;
