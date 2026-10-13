// NoxHere background worker.
//
// Owns durable queue consumption plus the small amount of periodic work that
// cannot be driven reliably by webhooks: report schedules, reconciliation,
// recovery, health sweeps, and retention.
//
// See migrations/0013_reconcile_observability.sql for the
// `reconcile_runs` table this writes to.

import { reconcileOrg } from "./reconcile.js";
import { archiveOldEvents } from "./archive-events.js";
import { TASK } from "../../../functions/lib/tasks.js";
import { narrateEvent, narrateReleaseNotes, narratePrOpened } from "../../../functions/lib/narrator.js";
import { bootstrapInstallation, syncRepo } from "../../../functions/lib/github-sync.js";
import { getInstallationToken } from "../../../functions/lib/github-app.js";
import { recordFailure } from "../../../functions/lib/op-failures.js";
import { runNextStatsAudit } from "./stats-audit.js";
import { runDatabaseRecoveryStep } from "./database-recovery.js";
import { createFeedbackGitHubIssue, finalizeFeedbackGitHubIssue } from "../../../functions/lib/feedback.js";
import {
  recoverFeedbackResolutionPreparations,
  recoverFeedbackResolutionEmails,
} from "../../../functions/lib/feedback-resolution.js";
import { markOutboxFailed, recoverOutboxDeliveries, requeueBlockedForOrg } from "../../../functions/lib/delivery-outbox.js";
import { runTelemetryDigests } from "./telemetry-digests.js";
import { runFeedbackDailyDigests } from "./feedback-digests.js";
import { runActivityDailySummaries } from "./activity-daily-summaries.js";
import { createOrUpdateTelemetryGitHubIssue, finalizeTelemetryGitHubIssue, recoverTelemetryGithubIncidents } from "../../../functions/lib/telemetry-github.js";
import { runOperationalAlerts } from "./operational-alerts.js";
import { recordHeartbeatAttempt, recordHeartbeatFailure, recordHeartbeatSuccess } from "../../../functions/lib/service-heartbeats.js";
import { isTenantConfigurationFailure, reportTelemetryRuntimeFailure } from "./telemetry-runtime.js";
import { executeTransportCallback, executeTransportCommand, recoverTransportCallbacks, recoverTransportCommands, requeueBlockedTransportCommands, TransportExecutionError } from "../../../functions/lib/transport-outbox.ts";
import { projectPlatformEvent } from "../../../functions/lib/platform-event-projector.ts";
import { recoverPlatformEventProjections } from "../../../functions/lib/platform-event-store.ts";
import { recoverTransportDeliveryEvents } from "../../../functions/lib/transport-delivery-events.ts";
import { recoverAbandonedReconciliations } from "./reconciliation-recovery.js";

// Bound how many independent reconciliation messages a maintenance tick can
// publish. Queue consumers process one organization per invocation.
const MAX_RECONCILIATIONS_PER_TICK = 100;

// Cloudflare delivers a message up to (1 + max_retries) times (msg.attempts is
// 1-based). We record the terminal failure on the FINAL delivery, so this must
// equal max_retries + 1 (max_retries is set in services/scheduler/wrangler.toml).
const MAX_DELIVERIES = 5;
const HEARTBEAT = Object.freeze({
  schedule: "background.schedule",
  reports: "background.reports",
  maintenance: "background.maintenance",
  reconciliationRecovery: "background.reconciliation-recovery",
  archive: "background.archive",
  queue: "background.queue",
});

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledEvent(env, event));
  },

  // Durable background work, produced by functions/api/webhook.js. Replaces the
  // webhook's old context.waitUntil calls — these now get retries + a DLQ.
  async queue(batch, env) {
    await recordHeartbeatAttempt(env.DB, HEARTBEAT.queue, env.CF_VERSION_METADATA?.id);
    try {
      for (const msg of batch.messages) {
        try {
          await handleTask(env, msg.body);
          msg.ack();
        } catch (err) {
          console.error(`[noxhere-background] task ${msg.body?.type} failed (attempt ${msg.attempts}):`, err?.message ?? err);
          if (msg.attempts >= MAX_DELIVERIES) {
            // Out of retries — record to the admin-visible op_failures table and
            // ack so it doesn't loop forever (the DLQ is the backstop in config).
            await recordFailure(env.DB, {
              ownerId: msg.body?.ownerId ?? null,
              op: `task:${msg.body?.type ?? "unknown"}`,
              deliveryId: msg.body?.deliveryId ?? null,
              error: err,
            });
            if (msg.body?.type === TASK.DELIVER_SLACK && msg.body?.outboxId) {
              await markOutboxFailed(env.DB, msg.body.outboxId, err);
            }
            if (!(msg.body?.type === TASK.RECONCILE_ORG && isTenantConfigurationFailure(err))) {
              await reportTelemetryRuntimeFailure(env, err, {
                operation: `queue.${msg.body?.type ?? "unknown"}`,
                title: `NoxHere background task exhausted its retries`,
                message: "A durable background task failed on every delivery attempt.",
              });
            }
            msg.ack();
          } else {
            msg.retry();
          }
        }
      }
      await recordHeartbeatSuccess(env.DB, HEARTBEAT.queue, env.CF_VERSION_METADATA?.id);
    } catch (err) {
      await recordHeartbeatFailure(env.DB, HEARTBEAT.queue, err, env.CF_VERSION_METADATA?.id);
      await reportTelemetryRuntimeFailure(env, err, { operation: HEARTBEAT.queue });
      throw err;
    }
  },

  // Manual trigger for `wrangler dev --test-scheduled` and curl /__scheduled.
  async fetch(request, env, ctx) {
    // These routes mutate shared state and exist only for deliberate local
    // diagnostics. Production has no ENABLE_MANUAL_CRON binding, so its public
    // workers.dev hostname exposes no operator surface.
    if (env.ENABLE_MANUAL_CRON !== "true") return new Response("not found", { status: 404 });
    const url = new URL(request.url);
    if (url.pathname === "/__scheduled") {
      ctx.waitUntil(runTick(env));
      return new Response("ok\n");
    }
    if (url.pathname === "/__archive-events") {
      const result = await archiveOldEvents(env, Date.now());
      return new Response(`${JSON.stringify(result)}\n`);
    }
    if (url.pathname === "/__recover") {
      const result = await runDatabaseRecoveryStep(env);
      return Response.json(result);
    }
    return new Response("not found", { status: 404 });
  },
};

async function runScheduledEvent(env, event) {
  // This heartbeat proves Cloudflare delivered a trigger. Job health is tracked
  // separately so a provider failure cannot make the HTTP API look unavailable.
  await recordHeartbeatAttempt(env.DB, HEARTBEAT.schedule, env.CF_VERSION_METADATA?.id);
  await recordHeartbeatSuccess(env.DB, HEARTBEAT.schedule, env.CF_VERSION_METADATA?.id);

  const reportScheduleTick = event.cron === "* * * * *";
  if (reportScheduleTick) {
    await runTrackedJob(
      env,
      HEARTBEAT.reconciliationRecovery,
      "background.reconciliation-recovery",
      () => recoverAbandonedReconciliations(env, event.scheduledTime),
    );
    await runTrackedJob(env, HEARTBEAT.reports, "background.reports", () => (
      runReportSchedules(env, event.scheduledTime)
    ));
    return;
  }

  await runTrackedJob(env, HEARTBEAT.maintenance, "background.maintenance", () => (
    runTick(env, event.scheduledTime, false)
  ));

  // Daily event-table archival/retention is gated to the 03:00 UTC ticks. The
  // operation is idempotent, so both 03:xx maintenance ticks may drain backlog.
  if (new Date(event.scheduledTime).getUTCHours() === 3) {
    await runArchive(env, event.scheduledTime);
  }
}

async function runTrackedJob(env, component, operation, run) {
  await recordHeartbeatAttempt(env.DB, component, env.CF_VERSION_METADATA?.id);
  try {
    await run();
    await recordHeartbeatSuccess(env.DB, component, env.CF_VERSION_METADATA?.id);
  } catch (err) {
    await recordHeartbeatFailure(env.DB, component, err, env.CF_VERSION_METADATA?.id);
    await reportTelemetryRuntimeFailure(env, err, { operation });
  }
}

async function runArchive(env, nowMs) {
  await recordHeartbeatAttempt(env.DB, HEARTBEAT.archive, env.CF_VERSION_METADATA?.id);
  try {
    await archiveOldEvents(env, nowMs);
    await recordHeartbeatSuccess(env.DB, HEARTBEAT.archive, env.CF_VERSION_METADATA?.id);
  } catch (err) {
    console.error("[noxhere-background] event archival failed:", err?.message ?? err);
    await recordHeartbeatFailure(env.DB, HEARTBEAT.archive, err, env.CF_VERSION_METADATA?.id);
    await reportTelemetryRuntimeFailure(env, err, { operation: "background.archive" });
  }
}

async function reportBackgroundComponentFailure(env, operation, error) {
  await reportTelemetryRuntimeFailure(env, error, { operation });
}

// Dispatch a queued task to the same helpers the webhook used to call inline.
async function handleTask(env, body) {
  switch (body?.type) {
    case TASK.NARRATE:
      return narrateEvent(env, body.eventId);
    case TASK.RELEASE_NOTES:
      return narrateReleaseNotes(env, body.eventId);
    case TASK.NARRATE_PR_OPENED:
      return narratePrOpened(env, body.eventId);
    case TASK.BOOTSTRAP:
      return bootstrapInstallation(env, body.orgId, body.accountLogin, body.installationId);
    case TASK.SYNC_REPO: {
      const token = await getInstallationToken(env, body.installationId);
      return syncRepo(env.DB, token, body.orgId, body.accountLogin, body.repo, true);
    }
    case TASK.RECONCILE_ORG:
      return reconcileOrg(env, env.DB, body.orgId, body.accountLogin, body.installationId);
    case TASK.SPOT_CREATE_GITHUB_ISSUE:
      return createFeedbackGitHubIssue(env, body);
    case TASK.SPOT_PREPARE_RESOLUTION_EMAIL:
      return env.NOXHERE.prepareFeedbackResolutionEmail(body.reportId);
    case TASK.SPOT_SEND_RESOLUTION_EMAIL:
      return env.NOXHERE.deliverFeedbackResolutionEmail(body.reportId);
    case TASK.TELEMETRY_GITHUB_ISSUE:
      return createOrUpdateTelemetryGitHubIssue(env, body);
    case TASK.DELIVER_SLACK:
      return env.NOXHERE.deliverSlackOutbox(body.outboxId);
    case TASK.DELIVER_TRANSPORT:
      return executeTransportCommand(env, body.outboxId, {
        slack: (command) => deliverTransport(env, command),
        github: (command) => deliverTransport(env, command),
      });
    case TASK.FINALIZE_TRANSPORT:
      return executeTransportCallback(env.DB, body.outboxId, {
        feedback_issue: (input) => finalizeFeedbackGitHubIssue(env, input),
        telemetry_incident: (input) => finalizeTelemetryGitHubIssue(env, input),
      });
    case TASK.PROJECT_PLATFORM_EVENT:
      return projectPlatformEvent(env.DB, body.eventId);
    default:
      throw new Error(`unknown task type: ${body?.type}`);
  }
}

async function deliverTransport(env, command) {
  const receipt = await env.NOXHERE.deliverTransport(command);
  if (receipt?.ok) return receipt.result;
  throw new TransportExecutionError(
    receipt?.error?.message ?? "Connection transport failed",
    receipt?.error?.code ?? "transport_failed",
    receipt?.error?.disposition ?? "retryable",
  );
}

async function runTick(env, nowMs = Date.now(), includeReportSchedules = true) {
  const db = env.DB;

  await recoverFeedbackResolutionPreparations(env);
  await recoverOutboxDeliveries(env);
  await recoverTransportCommands(env);
  await recoverTransportCallbacks(env);
  await recoverPlatformEventProjections(env);
  await recoverTransportDeliveryEvents(env);
  await recoverFeedbackResolutionEmails(env);
  try {
    await recoverTelemetryGithubIncidents(env);
  } catch (err) {
    console.error("[noxhere-background] Telemetry GitHub issue recovery failed:", err?.message ?? err);
    await reportBackgroundComponentFailure(env, "telemetry.github-recovery", err);
  }
  await runSlackHealthSweep(env);
  try {
    await runOperationalAlerts(env);
  } catch (err) {
    console.error(JSON.stringify({
      event: "operational_alert_sweep_failed",
      error: err instanceof Error ? err.message : String(err),
    }));
    await reportBackgroundComponentFailure(env, "operational-alerts.sweep", err);
  }
  await healOrgInstallationLinks(db);

  if (includeReportSchedules) await runReportSchedules(env, nowMs);

  // Process at most one explicitly-requested source-of-truth audit per tick.
  // Each request is bounded to 120 monthly GitHub Search calls and is durable
  // in D1, so a failed audit is visible instead of silently skewing metrics.
  try {
    await runNextStatsAudit(env);
  } catch (err) {
    console.error("[noxhere-background] stats audit failed:", err?.message ?? err);
    await reportBackgroundComponentFailure(env, "stats.audit", err);
  }

  try {
    await runDatabaseRecoveryStep(env);
  } catch (err) {
    console.error("[noxhere-background] database recovery step failed:", err?.message ?? err);
    await reportBackgroundComponentFailure(env, "database.recovery", err);
  }

  const orgs = await db
    .prepare(
      `SELECT id, github_login, installation_id
       FROM orgs
       WHERE installation_id IS NOT NULL AND bootstrapped_at IS NOT NULL
       ORDER BY id
       LIMIT ?`
    )
    .bind(MAX_RECONCILIATIONS_PER_TICK)
    .all();

  const reconciliationTasks = (orgs.results ?? []).map((org) => ({
    body: {
      type: TASK.RECONCILE_ORG,
      orgId: org.id,
      accountLogin: org.github_login,
      installationId: org.installation_id,
      ownerId: org.github_login,
      deliveryId: `reconcile:${org.id}:${nowMs}`,
    },
  }));
  if (reconciliationTasks.length > 0) {
    await env.TASK_QUEUE.sendBatch(reconciliationTasks);
  }
}

async function runReportSchedules(env, nowMs) {
  for (const [operation, label, run] of [
    ["telemetry.digest-sweep", "Telemetry digest", runTelemetryDigests],
    ["feedback.digest-sweep", "Feedback daily digest", runFeedbackDailyDigests],
    ["activity.summary-sweep", "Activity daily summary", runActivityDailySummaries],
  ]) {
    try {
      await run(env, nowMs);
    } catch (err) {
      console.error(`[noxhere-background] ${label} sweep failed:`, err?.message ?? err);
      await reportBackgroundComponentFailure(env, operation, err);
    }
  }
}

async function runSlackHealthSweep(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, org_id FROM slack_connections
      WHERE last_checked_at IS NULL
         OR last_checked_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes')
      ORDER BY COALESCE(last_checked_at, '')
      LIMIT 10`,
  ).all();
  for (const row of results ?? []) {
    try {
      const health = await env.NOXHERE.checkSlackOrgHealth(row.org_id, row.id);
      if (health.recovered) {
        await Promise.all([
          requeueBlockedForOrg(env, row.org_id),
          requeueBlockedTransportCommands(env, { orgId: row.org_id }),
        ]);
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "slack_health_check_failed",
        orgId: row.org_id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
}

// Self-heal: link `orgs` rows to their matching `installations` row and
// stamp `bootstrapped_at` whenever either is missing. Covers orgs that
// predate the bootstrap-on-install path (Slice 1) and any future row
// that lands in D1 without those columns set. Idempotent — once both
// columns are populated the row drops out of the WHERE clause.
async function healOrgInstallationLinks(db) {
  const res = await db
    .prepare(
      `UPDATE orgs SET
         installation_id = (SELECT installation_id FROM installations WHERE account_login = orgs.github_login),
         bootstrapped_at = COALESCE(bootstrapped_at, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       WHERE (installation_id IS NULL OR bootstrapped_at IS NULL)
         AND EXISTS (SELECT 1 FROM installations WHERE account_login = orgs.github_login)`,
    )
    .run();
  const changed = res?.meta?.changes ?? 0;
  if (changed > 0) {
    console.log(`[noxhere-background] healed ${changed} org→installation link(s)`);
  }
}
