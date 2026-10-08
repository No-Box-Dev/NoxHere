-- Prevent the pre-repair backlog from being replayed automatically once the
-- buildGitHubIncident RPC is restored. Only rows carrying the exact historical
-- missing-method failure are affected; unrelated delivery failures stay put.
UPDATE cue_github_incidents
SET status = 'disabled',
    last_error = 'quarantined_pre_rpc_repair',
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE status IN ('pending', 'failed')
  AND last_error LIKE '%does not implement the method%buildGitHubIncident%';
