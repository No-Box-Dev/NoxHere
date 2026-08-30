import { z } from "zod";

export const AUTH_FEATURES = [
  "auth.signup",
  "auth.login",
  "auth.password_reset",
  "auth.email_verification",
  "auth.oauth",
  "auth.mfa",
  "auth.session_refresh",
  "auth.logout",
] as const;

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

export const cueFeatureResultSchema = z.object({
  version: z.literal(1).default(1),
  type: z.literal("feature.result"),
  eventId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  feature: z.enum(AUTH_FEATURES),
  outcome: z.enum(["success", "rejected", "failure"]),
  reason: z.enum(FEATURE_REASONS).optional(),
  durationMs: z.number().int().min(0).max(120_000).optional(),
  test: z.boolean().default(false),
  occurredAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export type CueFeatureResult = z.infer<typeof cueFeatureResultSchema>;

export interface FeatureSource {
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
}

interface StateRow {
  status: "waiting" | "healthy" | "issue";
  consecutive_failures: number;
  consecutive_successes: number;
  incident_started_at: string | null;
}

interface SlackTask {
  type: "deliver_slack";
  outboxId: string;
  ownerId: string;
  deliveryId: string;
}

const LABELS: Record<(typeof AUTH_FEATURES)[number], string> = {
  "auth.signup": "Sign up",
  "auth.login": "Log in",
  "auth.password_reset": "Password reset",
  "auth.email_verification": "Email verification",
  "auth.oauth": "OAuth / SSO",
  "auth.mfa": "Multi-factor authentication",
  "auth.session_refresh": "Session refresh",
  "auth.logout": "Log out",
};

function slackMessage(source: FeatureSource, event: CueFeatureResult, recovered: boolean) {
  const label = LABELS[event.feature];
  const headline = recovered ? `${label} recovered` : `${label} has an issue`;
  const detail = recovered
    ? "Two successful attempts were received after the incident."
    : `Three consecutive system failures were received${event.reason ? ` · ${event.reason.replaceAll("_", " ")}` : ""}.`;
  return {
    text: `${source.source_name}: ${headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${recovered ? ":white_check_mark:" : ":rotating_light:"} *${headline}*\n${detail}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: `NoxCue · ${source.source_name} · ${event.feature}` }] },
    ],
  };
}

async function stageDelivery(
  env: Env,
  source: FeatureSource,
  event: CueFeatureResult,
  transition: "issue" | "recovery",
  transitionAt: string,
): Promise<boolean> {
  if (!source.slack_channel_id) return false;
  const sourceId = `feature:${source.source_id}:${event.feature}:${transition}:${transitionAt}`;
  const deliveryId = crypto.randomUUID();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO delivery_outbox
       (id, org_id, source, source_id, destination, site_id, slack_connection_id,
        channel_id, payload_json, status)
     VALUES (?, ?, 'noxcue', ?, 'slack', NULL, ?, ?, ?, 'pending')`,
  ).bind(
    deliveryId, source.org_id, sourceId, source.slack_connection_id, source.slack_channel_id,
    JSON.stringify({ message: slackMessage(source, event, transition === "recovery") }),
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
): Promise<{ eventId: string; duplicate: boolean; status: StateRow["status"]; queued: boolean }> {
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const now = new Date().toISOString();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO cue_feature_results
       (org_id, source_id, event_id, feature_key, outcome, reason, duration_ms, is_test, occurred_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(source.org_id, source.source_id, eventId, event.feature, event.outcome,
    event.reason ?? null, event.durationMs ?? null, event.test ? 1 : 0, occurredAt.toISOString(), now).run();
  const previous = await env.NOX_DB.prepare(
    `SELECT status, consecutive_failures, consecutive_successes, incident_started_at
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
    if (failures >= 3) {
      status = "issue";
      incidentAt ??= now;
    }
  } else if (event.outcome === "success") {
    failures = 0;
    successes = oldStatus === "issue" ? successes + 1 : 0;
    if (oldStatus !== "issue" || successes >= 2) {
      status = "healthy";
      incidentAt = null;
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
    event.reason ?? null, now).run();

  const transition = oldStatus !== "issue" && status === "issue"
    ? "issue"
    : oldStatus === "issue" && status === "healthy" ? "recovery" : null;
  const queued = transition ? await stageDelivery(env, source, event, transition, transition === "issue" ? incidentAt! : now) : false;
  return { eventId, duplicate: false, status, queued };
}
