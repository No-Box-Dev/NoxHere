-- Catalog every metric produced by unified NoxCue event tracking. Daily
-- digest persistence references this table, so missing definitions must never
-- prevent an otherwise valid report from being delivered.
INSERT OR IGNORE INTO cue_metric_definitions
  (key, label, domain, unit, origin, description, formula_key, version)
VALUES
  ('subscriptions.trials.new', 'New trial users', 'users', 'count', 'calculated', 'Distinct users who started a trial during the local day.', 'subscriptions.trials.new', 2),
  ('subscriptions.trials.total', 'Total trial users', 'users', 'count', 'calculated', 'Distinct users who have started a trial through the end of the local day.', 'subscriptions.trials.total', 2),
  ('subscriptions.paid.new', 'New paid users', 'users', 'count', 'calculated', 'Distinct users who became paid during the local day.', 'subscriptions.paid.new', 2),
  ('subscriptions.paid.total', 'Total paid users', 'users', 'count', 'calculated', 'Distinct users who have become paid through the end of the local day.', 'subscriptions.paid.total', 2),
  ('subscriptions.trial_to_paid', 'Trial-to-paid conversion', 'users', 'ratio', 'calculated', 'Total paid users divided by total trial users.', 'subscriptions.trial_to_paid', 2),
  ('subscriptions.churn', 'Churn', 'users', 'ratio', 'calculated', 'Users who cancelled during the local day divided by total paid users.', 'subscriptions.churn', 2),
  ('records.parsed', 'Records parsed', 'users', 'count', 'calculated', 'Records parsed during the local day.', 'records.parsed', 2),
  ('records.parsed.per_active', 'Records parsed per active user', 'users', 'ratio', 'calculated', 'Records parsed during the local day divided by daily active users.', 'records.parsed.per_active', 2),
  ('records.parsed.users.total', 'Users who parsed records', 'users', 'count', 'calculated', 'Distinct users who have parsed records through the end of the local day.', 'records.parsed.users.total', 2),
  ('reports.generated', 'Reports generated', 'users', 'count', 'calculated', 'Reports generated during the local day.', 'reports.generated', 2),
  ('reports.generated.per_active', 'Reports generated per active user', 'users', 'ratio', 'calculated', 'Reports generated during the local day divided by daily active users.', 'reports.generated.per_active', 2),
  ('reports.generated.users.total', 'Users who generated reports', 'users', 'count', 'calculated', 'Distinct users who have generated reports through the end of the local day.', 'reports.generated.users.total', 2);
