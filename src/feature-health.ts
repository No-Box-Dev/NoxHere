import { z } from "zod";
import type { ResolvedFeature } from "./feature-catalog";
import { cueEnvironmentSchema, type CueEnvironment } from "./environment";

export const FEATURE_REASONS = [
  "invalid_input",
  "invalid_credentials",
  "account_exists",
  "account_unverified",
  "account_locked",
  "verification_expired",
  "mfa_required",
  "rate_limited",
  "policy_rejected",
  "dependency_unavailable",
  "database_unavailable",
  "email_delivery_failed",
  "oauth_failed",
  "session_failed",
  "configuration_error",
  "timeout",
  "network_error",
  "internal_error",
  "unknown",
] as const;

const FEATURE_KEY_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,5}$/;

export const cueFeatureResultSchema = z.object({
  version: z.literal(1).default(1),
  type: z.literal("feature.result"),
  eventId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  environment: cueEnvironmentSchema.optional(),
  feature: z.string().trim().min(1).max(120).regex(FEATURE_KEY_PATTERN),
  outcome: z.enum(["success", "rejected", "failure"]),
  reason: z.enum(FEATURE_REASONS).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  error: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().min(1).max(2_000),
    code: z.string().trim().min(1).max(120).optional(),
    status: z.number().int().min(100).max(599).optional(),
  }).strict().optional(),
  durationMs: z.number().int().min(0).max(120_000).optional(),
  test: z.boolean().default(false),
  occurredAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((event, ctx) => {
  if (event.outcome === "failure" && !event.error) {
    ctx.addIssue({ code: "custom", path: ["error"], message: "A failure must include the actual error" });
  }
  if (event.outcome !== "failure" && event.error) {
    ctx.addIssue({ code: "custom", path: ["error"], message: "Only failures may include an error" });
  }
});

export type CueFeatureResult = z.infer<typeof cueFeatureResultSchema>;

export interface FeatureSource {
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  environment: CueEnvironment;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
}

interface StateRow {
  status: "waiting" | "healthy" | "issue";
  consecutive_failures: number;
  consecutive_successes: number;
  incident_started_at: string | null;
  last_reason: string | null;
}

interface SlackTask {
  type: "deliver_slack";
  outboxId: string;
  ownerId: string;
  deliveryId: string;
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slackMessage(source: FeatureSource, definition: ResolvedFeature, event: CueFeatureResult) {
  const headline = `${definition.label} failed`;
  const impact = event.message ?? definition.failureMessage;
  const technical = [event.error?.code, event.error?.message].filter(Boolean).join(": ");
  return {
    text: `${source.source_name}: ${headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:rotating_light: *${escapeSlack(headline)}*\n${escapeSlack(impact)}\n*Error:* ${escapeSlack(technical)}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: `NoxCue · ${escapeSlack(source.source_name)} · ${escapeSlack(source.environment)} · ${escapeSlack(event.feature)}` }] },
    ],
  };
}

async function stageDelivery(
  env: Env,
  source: FeatureSource,
  definition: ResolvedFeature,
  event: CueFeatureResult,
  eventId: string,
): Promise<boolean> {
  if (!source.slack_channel_id) return false;
  const sourceId = `feature:${source.source_id}:${event.feature}:incident:${eventId}`;
  const deliveryId = crypto.randomUUID();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO delivery_outbox
       (id, org_id, source, source_id, destination, site_id, slack_connection_id,
        channel_id, payload_json, status)
     VALUES (?, ?, 'noxcue', ?, 'slack', NULL, ?, ?, ?, 'pending')`,
  ).bind(
    deliveryId, source.org_id, sourceId, source.slack_connection_id, source.slack_channel_id,
    JSON.stringify({ message: slackMessage(source, definition, event) }),
  ).run();
  if (!inserted.meta.changes) return false;
  try {
    const task: SlackTask = { type: "deliver_slack", outboxId: deliveryId, ownerId: source.owner_id, deliveryId };
    await env.NOX_TASKS.send(task);
    await env.NOX_DB.prepare(
      `UPDATE delivery_outbox SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'pending'`,
    ).bind(new Date().toISOString(), deliveryId).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({ message: "feature health queue send failed", sourceId, deliveryId,
      error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

export async function storeFeatureResult(
  env: Env,
  source: FeatureSource,
  event: CueFeatureResult,
  eventId: string,
  definition: ResolvedFeature,
): Promise<{ eventId: string; duplicate: boolean; status: StateRow["status"]; queued: boolean }> {
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const now = new Date().toISOString();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO cue_feature_results
       (org_id, source_id, event_id, feature_key, feature_kind, outcome, reason,
        message, error_json, duration_ms, is_test, occurred_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(source.org_id, source.source_id, eventId, event.feature, definition.kind,
    event.outcome, event.reason ?? null,
    event.outcome === "failure" ? event.message ?? definition.failureMessage : null,
    event.error ? JSON.stringify(event.error) : null,
    event.durationMs ?? null, event.test ? 1 : 0, occurredAt.toISOString(), now).run();
  const previous = await env.NOX_DB.prepare(
    `SELECT status, consecutive_failures, consecutive_successes, incident_started_at, last_reason
       FROM cue_feature_states WHERE source_id = ? AND feature_key = ?`,
  ).bind(source.source_id, event.feature).first<StateRow>();
  if (!inserted.meta.changes) {
    return { eventId, duplicate: true, status: previous?.status ?? "waiting", queued: false };
  }
  if (event.test) return { eventId, duplicate: false, status: previous?.status ?? "waiting", queued: false };

  const oldStatus = previous?.status ?? "waiting";
  let status = oldStatus;
  let failures = previous?.consecutive_failures ?? 0;
  let successes = previous?.consecutive_successes ?? 0;
  let incidentAt = previous?.incident_started_at ?? null;
  if (event.outcome === "failure") {
    failures += 1;
    successes = 0;
    status = "issue";
    incidentAt ??= now;
  } else if (event.outcome === "success") {
    if (oldStatus === "issue") {
      successes += 1;
    } else {
      status = "healthy";
      incidentAt = null;
      failures = 0;
      successes = 0;
    }
  }

  await env.NOX_DB.prepare(
    `INSERT INTO cue_feature_states
       (org_id, source_id, feature_key, status, consecutive_failures, consecutive_successes,
        incident_started_at, last_result_at, last_success_at, last_failure_at, last_reason, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_id, feature_key) DO UPDATE SET
       status = excluded.status, consecutive_failures = excluded.consecutive_failures,
       consecutive_successes = excluded.consecutive_successes,
       incident_started_at = excluded.incident_started_at, last_result_at = excluded.last_result_at,
       last_success_at = COALESCE(excluded.last_success_at, cue_feature_states.last_success_at),
       last_failure_at = COALESCE(excluded.last_failure_at, cue_feature_states.last_failure_at),
       last_reason = excluded.last_reason, updated_at = excluded.updated_at`,
  ).bind(source.org_id, source.source_id, event.feature, status, failures, successes, incidentAt,
    now, event.outcome === "success" ? now : null, event.outcome === "failure" ? now : null,
    event.outcome === "failure" ? event.reason ?? "unknown" : oldStatus === "issue" ? previous?.last_reason ?? null : event.reason ?? null,
    now).run();

  // A feature failure means a user-facing action did not work. Each distinct
  // failure is its own incident; later successful attempts are evidence only
  // and must never silently resolve it.
  const queued = event.outcome === "failure" ? await stageDelivery(env, source, definition, event, eventId) : false;
  return { eventId, duplicate: false, status, queued };
}
