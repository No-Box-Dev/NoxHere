-- Preserve who originally opened each Slack connection separately from the
-- latest reconnect, allow admins to give it a recognizable name, and record
-- when Nox last used it successfully.
ALTER TABLE slack_connections ADD COLUMN display_name TEXT;
ALTER TABLE slack_connections ADD COLUMN opened_by TEXT;
ALTER TABLE slack_connections ADD COLUMN opened_at TEXT;
ALTER TABLE slack_connections ADD COLUMN last_used_at TEXT;

UPDATE slack_connections
SET opened_by = COALESCE(opened_by, installed_by),
    opened_at = COALESCE(opened_at, installed_at);

