import { z } from "zod";
import type { ResolvedFeature } from "./feature-catalog";
import { cueEnvironmentSchema, type CueEnvironment } from "./environment";
import { featureIncidentKey, stageGithubIncident } from "./github-incidents";
import { publishSlackTransport } from "../../../functions/lib/transport-outbox";

const FEATURE_REASONS = [
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
const PROTECTED_IDENTITY_PATTERN = /^h1_[a-z0-9-]{1,32}_[A-Za-z0-9_-]{43}$/;

async function hashIdentity(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const diagnosticContextSchema = z.object({
  environment: z.string().trim().min(1).max(80).optional(),
  release: z.string().trim().min(1).max(120).optional(),
  runtime: z.enum(["browser", "server", "edge", "unknown"]).optional(),
  url: z.string().url().max(2_048).optional(),
  sdkVersion: z.string().trim().min(1).max(40).optional(),
}).strict();

export const safeErrorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(2_000),
  code: z.string().trim().min(1).max(120).optional(),
  status: z.number().int().min(100).max(599).optional(),
  stack: z.string().trim().min(1).max(8_000).optional(),
}).strict();

export const cueFeatureResultSchema = z.object({
  version: z.literal(1).default(1),
  type: z.literal("feature.result"),
  eventId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  environment: cueEnvironmentSchema.optional(),
  feature: z.string().trim().min(1).max(120).regex(FEATURE_KEY_PATTERN),
  outcome: z.enum(["success", "rejected", "failure"]),
  reason: z.enum(FEATURE_REASONS).optional(),
  message: z.string().trim().min(1).max(2_000).optional(),
  error: safeErrorSchema.optional(),
  context: diagnosticContextSchema.optional(),
  durationMs: z.number().int().min(0).max(120_000).optional(),
  test: z.boolean().default(false),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  userId: z.string().regex(PROTECTED_IDENTITY_PATTERN).optional(),
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
  project_id: string | null;
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

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface FeatureDiagnosis {
  summary: string;
  possibleCauses: string[];
  possibleFixes: string[];
}

export function redactDiagnosticText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/([?&](?:token|key|secret|password|code)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}

export function sanitizeDiagnosticUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? `${url.origin}${url.pathname}` : undefined;
  } catch { return undefined; }
}

function sanitizeFeatureResult(event: CueFeatureResult): CueFeatureResult {
  return {
    ...event,
    message: event.message ? redactDiagnosticText(event.message) : undefined,
    error: event.error ? {
      ...event.error,
      name: event.error.name ? redactDiagnosticText(event.error.name) : undefined,
      message: redactDiagnosticText(event.error.message),
      code: event.error.code ? redactDiagnosticText(event.error.code) : undefined,
      stack: event.error.stack ? redactDiagnosticText(event.error.stack) : undefined,
    } : undefined,
    context: event.context ? { ...event.context, url: sanitizeDiagnosticUrl(event.context.url) } : undefined,
  };
}

const DIAGNOSES: Record<(typeof FEATURE_REASONS)[number], Omit<FeatureDiagnosis, "summary">> = {
  invalid_input: { possibleCauses: ["The submitted fields failed application validation."], possibleFixes: ["Confirm required fields and validation rules match between the client and API."] },
  invalid_credentials: { possibleCauses: ["The supplied credentials were not accepted."], possibleFixes: ["Confirm this is an expected user rejection; inspect auth-provider logs if valid credentials also fail."] },
  account_exists: { possibleCauses: ["An account already exists for this identity."], possibleFixes: ["Offer login or password reset without exposing whether an account exists to unauthenticated users."] },
  account_unverified: { possibleCauses: ["The account has not completed verification."], possibleFixes: ["Confirm verification emails are delivered and the resend flow works."] },
  account_locked: { possibleCauses: ["The account or identity was locked by policy."], possibleFixes: ["Check lockout policy and provide a safe account-recovery path."] },
  verification_expired: { possibleCauses: ["The verification token expired before use."], possibleFixes: ["Check token lifetime, clock skew and the resend-verification flow."] },
  mfa_required: { possibleCauses: ["Authentication requires an additional factor."], possibleFixes: ["Ensure the client handles the MFA challenge and continuation state."] },
  rate_limited: { possibleCauses: ["The app or an upstream provider rejected excess requests."], possibleFixes: ["Inspect request volume and provider limits; add bounded retry with backoff where safe."] },
  policy_rejected: { possibleCauses: ["A configured authentication or security policy rejected the request."], possibleFixes: ["Review the matching provider policy and the request attributes it evaluates."] },
  dependency_unavailable: { possibleCauses: ["The authentication provider or another required upstream returned a server error.", "Production credentials or provider configuration may be invalid."], possibleFixes: ["Check provider status and request logs.", "Verify production credentials, callback URLs and environment configuration.", "Confirm the app exposes a safe retry path to the user."] },
  database_unavailable: { possibleCauses: ["The application could not reach its user database.", "The database may have exhausted connections or failed over."], possibleFixes: ["Check database health, connection limits and recent failovers.", "Inspect the failed request trace around the recorded time."] },
  email_delivery_failed: { possibleCauses: ["The email provider rejected or could not deliver the message.", "The sender domain or template configuration may be invalid."], possibleFixes: ["Inspect the provider delivery log and suppression list.", "Verify sender-domain authentication and the production template.", "Check provider quota and rate limits."] },
  oauth_failed: { possibleCauses: ["The external identity provider rejected the OAuth exchange."], possibleFixes: ["Verify callback URL, client credentials, scopes and state/PKCE handling.", "Inspect the provider error recorded below."] },
  session_failed: { possibleCauses: ["The application could not create or refresh the authenticated session."], possibleFixes: ["Check signing keys, cookie settings, session storage and clock skew."] },
  configuration_error: { possibleCauses: ["Required production configuration is missing or inconsistent."], possibleFixes: ["Compare deployed environment variables and provider settings with the expected production configuration."] },
  timeout: { possibleCauses: ["A required operation exceeded its deadline.", "An upstream service or network path may be slow."], possibleFixes: ["Inspect upstream latency at the recorded time.", "Verify timeout values and abort handling.", "Check whether the operation completed after the client stopped waiting."] },
  network_error: { possibleCauses: ["The request did not receive a usable response.", "DNS, TLS, CORS or client connectivity may have interrupted the request."], possibleFixes: ["Check browser and edge logs for DNS, TLS and CORS failures.", "Verify the upstream hostname and allowed origins.", "Confirm offline and retry behaviour is safe."] },
  internal_error: { possibleCauses: ["Application code raised an unexpected internal error."], possibleFixes: ["Inspect the sanitized stack and matching application log.", "Check the release for a recent regression.", "Reproduce the same journey with the recorded environment and release."] },
  unknown: { possibleCauses: ["The SDK could not classify the failure from the available evidence."], possibleFixes: ["Inspect the error, stack, release and event timing below.", "Add a stable error code or HTTP status so future failures classify precisely."] },
};

function diagnoseFeatureFailure(event: CueFeatureResult, label = event.feature): FeatureDiagnosis {
  const reason = event.reason ?? "unknown";
  const diagnosis = DIAGNOSES[reason];
  return {
    summary: `${label} failed: ${reason.replaceAll("_", " ")}.`,
    possibleCauses: diagnosis.possibleCauses,
    possibleFixes: diagnosis.possibleFixes,
  };
}

function slackMessage(source: FeatureSource, definition: ResolvedFeature, event: CueFeatureResult) {
  const headline = `${definition.label} failed`;
  const impact = definition.failureMessage;
  const reportedMessage = event.message ? `\n*Message:* ${escapeSlack(event.message)}` : "";
  const technical = [event.error?.code, event.error?.message].filter(Boolean).join(": ");
  const diagnosis = diagnoseFeatureFailure(event, definition.label);
  const context = [source.environment, event.context?.release ? `release ${event.context.release}` : null]
    .filter((value): value is string => Boolean(value)).join(" · ");
  const fixes = diagnosis.possibleFixes.map((fix) => `• ${escapeSlack(fix)}`).join("\n");
  return {
    text: `${source.source_name}: ${headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:rotating_light: *${escapeSlack(headline)}*\n${escapeSlack(impact)}${reportedMessage}\n*Error:* ${escapeSlack(technical)}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Possible fixes to investigate*\n${fixes}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: `NoxCue · ${escapeSlack(source.source_name)} · ${escapeSlack(context)} · ${escapeSlack(event.feature)} · detection only` }] },
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
  if (!source.slack_channel_id || !source.project_id) return false;
  const sourceId = `feature:${source.source_id}:${event.feature}:incident:${eventId}`;
  try {
    const publication = await publishSlackTransport({ DB: env.NOX_DB, TASK_QUEUE: env.NOX_TASKS }, {
      orgId: source.org_id,
      projectId: source.project_id,
      route: "incidents",
      routeContext: { kind: "source", id: source.source_id },
      idempotencyKey: `noxcue:${sourceId}`,
      message: slackMessage(source, definition, event),
    });
    return publication.queued;
  } catch (error) {
    console.error(JSON.stringify({ message: "feature health queue send failed", sourceId,
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
): Promise<{ eventId: string; duplicate: boolean; status: StateRow["status"]; queued: boolean; githubQueued?: boolean }> {
  event = sanitizeFeatureResult(event);
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const now = new Date().toISOString();
  const inserted = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO cue_feature_results
       (org_id, source_id, event_id, feature_key, feature_kind, outcome, reason,
        message, error_json, duration_ms, is_test, occurred_at, received_at, subject_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(source.org_id, source.source_id, eventId, event.feature, definition.kind,
    event.outcome, event.reason ?? null,
    event.outcome === "failure" ? event.message ?? definition.failureMessage : null,
    event.outcome === "failure" ? JSON.stringify({
      ...(event.error ?? { message: event.message ?? definition.failureMessage }),
      context: {
        source: source.source_name,
        environment: source.environment,
        release: event.context?.release ?? null,
        runtime: event.context?.runtime ?? "unknown",
        url: event.context?.url ?? null,
        sdkVersion: event.context?.sdkVersion ?? null,
      },
      diagnosis: diagnoseFeatureFailure(event, definition.label),
    }) : null,
    event.durationMs ?? null, event.test ? 1 : 0, occurredAt.toISOString(), now,
    event.userId ? await hashIdentity(`${source.source_id}\u0000${event.userId}`) : null).run();
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
  if (event.outcome !== "failure") return { eventId, duplicate: false, status, queued: false };
  const diagnosis = diagnoseFeatureFailure(event, definition.label);
  const [queued, githubQueued] = await Promise.all([
    stageDelivery(env, source, definition, event, eventId),
    stageGithubIncident(env, source, {
      key: featureIncidentKey(event),
      kind: "feature",
      title: `${definition.label} failed`,
      occurredAt: occurredAt.toISOString(),
      payload: {
        impact: definition.failureMessage,
        message: event.message,
        error: event.error,
        context: event.context,
        diagnosis,
      },
    }),
  ]);
  return { eventId, duplicate: false, status, queued, githubQueued };
}
