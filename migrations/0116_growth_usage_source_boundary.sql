-- Separate Growth acquisition/conversion sources from Usage product-intelligence sources.
-- Existing sources remain Usage sources; administrators create explicit Growth sources and keys.
ALTER TABLE telemetry_sources ADD COLUMN capability TEXT NOT NULL DEFAULT 'usage'
  CHECK (capability IN ('growth', 'usage', 'incidents'));

CREATE INDEX idx_telemetry_sources_capability_project
  ON telemetry_sources(org_id, project_id, capability, enabled);
