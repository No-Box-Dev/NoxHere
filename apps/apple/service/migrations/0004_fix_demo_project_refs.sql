UPDATE events
SET project_id = CASE repo
  WHEN 'care-api' THEN 'project-care-api'
  WHEN 'clinical-workflows' THEN 'project-clinical'
  WHEN 'patient-portal' THEN 'project-patient'
  WHEN 'mobile-app' THEN 'project-mobile'
  WHEN 'identity-service' THEN 'project-identity'
  WHEN 'billing-service' THEN 'project-billing'
  WHEN 'care-operations' THEN 'project-ops'
  WHEN 'health-analytics' THEN 'project-analytics'
  WHEN 'data-pipeline' THEN 'project-data'
  WHEN 'platform-infra' THEN 'project-platform'
  WHEN 'design-system' THEN 'project-design'
  WHEN 'developer-docs' THEN 'project-docs'
  ELSE project_id
END
WHERE repo IS NOT NULL;
