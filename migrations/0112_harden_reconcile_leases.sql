-- Enforce one active organization reconciliation at the database boundary and
-- retain enough state to recover work interrupted by a Worker deployment or
-- Cloudflare's queue-consumer wall-time limit.

ALTER TABLE reconcile_runs ADD COLUMN recovery_enqueued_at TEXT;

-- Historical cancellations could leave more than one unfinished row for an
-- organization. Keep the newest claim active and close older claims before the
-- unique partial index is created.
UPDATE reconcile_runs
   SET finished_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
       duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER),
       error = 'reconcile_abandoned'
 WHERE finished_at IS NULL
   AND id NOT IN (
     SELECT MAX(id)
       FROM reconcile_runs
      WHERE finished_at IS NULL
      GROUP BY org_id
   );

CREATE UNIQUE INDEX idx_reconcile_runs_one_active_org
  ON reconcile_runs(org_id)
  WHERE finished_at IS NULL;

CREATE INDEX idx_reconcile_runs_pending_recovery
  ON reconcile_runs(error, recovery_enqueued_at, id)
  WHERE error = 'reconcile_abandoned_pending_recovery';
