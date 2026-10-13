import { TASK } from "../../../functions/lib/tasks.js";

// Cloudflare Queue consumers have a 15-minute wall-clock limit. Give the
// platform one additional minute to finish cancellation bookkeeping before a
// minute tick claims the run for recovery.
export const RECONCILE_ABANDONED_AFTER_MINUTES = 16;
const MAX_RECOVERIES_PER_TICK = 100;
const PENDING_RECOVERY = "reconcile_abandoned_pending_recovery";

export async function recoverAbandonedReconciliations(env, nowMs = Date.now()) {
  const cutoff = new Date(
    nowMs - RECONCILE_ABANDONED_AFTER_MINUTES * 60 * 1000,
  ).toISOString();

  const marked = await env.DB.prepare(
    `UPDATE reconcile_runs
        SET finished_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER),
            error = ?
      WHERE finished_at IS NULL AND started_at <= ?`,
  ).bind(PENDING_RECOVERY, cutoff).run();

  // Pending rows survive a failed Queue publish. A later minute tick retries
  // the publish rather than silently losing the interrupted reconciliation.
  const pending = await env.DB.prepare(
    `SELECT rr.id AS run_id, o.id AS org_id, o.github_login, o.installation_id
       FROM reconcile_runs rr
       JOIN orgs o ON o.id = rr.org_id
      WHERE rr.error = ? AND rr.recovery_enqueued_at IS NULL
        AND o.installation_id IS NOT NULL AND o.bootstrapped_at IS NOT NULL
      ORDER BY rr.id
      LIMIT ?`,
  ).bind(PENDING_RECOVERY, MAX_RECOVERIES_PER_TICK).all();

  const rows = pending.results ?? [];
  const uniqueRows = [...new Map(rows.map((row) => [row.org_id, row])).values()];
  if (uniqueRows.length === 0) {
    return { abandoned: marked?.meta?.changes ?? 0, requeued: 0 };
  }

  await env.TASK_QUEUE.sendBatch(uniqueRows.map((row) => ({
    body: {
      type: TASK.RECONCILE_ORG,
      orgId: row.org_id,
      accountLogin: row.github_login,
      installationId: row.installation_id,
      ownerId: row.github_login,
      deliveryId: `reconcile-recovery:${row.org_id}:${row.run_id}:${nowMs}`,
    },
  })));

  const recoveredRunIds = rows.map((row) => row.run_id);
  const placeholders = recoveredRunIds.map(() => "?").join(", ");
  await env.DB.prepare(
    `UPDATE reconcile_runs
        SET error = 'reconcile_abandoned',
            recovery_enqueued_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id IN (${placeholders}) AND error = ? AND recovery_enqueued_at IS NULL`,
  ).bind(...recoveredRunIds, PENDING_RECOVERY).run();

  return {
    abandoned: marked?.meta?.changes ?? 0,
    requeued: uniqueRows.length,
  };
}
