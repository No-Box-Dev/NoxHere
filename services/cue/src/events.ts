import { z } from "zod";
import { localPeriodAt } from "./metrics";
import {
  cueFeatureResultSchema, diagnosticContextSchema, redactDiagnosticText,
  safeErrorSchema, sanitizeDiagnosticUrl, storeFeatureResult,
} from "./feature-health";
import { resolveFeature } from "./feature-catalog";
import { resolveActivityMetric, type ResolvedActivityMetric } from "./activity-catalog";
import { cueEnvironmentSchema, type CueEnvironment } from "./environment";
import { errorIncidentKey, stageGithubIncident } from "./github-incidents";
import { publishSlackTransport } from "../../../functions/lib/transport-outbox";

const MAX_BODY_BYTES = 32_768;
const protectedIdentity = z.string().regex(/^h1_[a-z0-9-]{1,32}_[A-Za-z0-9_-]{43}$/);
const eventName = z.string().trim().min(3).max(120)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,5}$/);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const diagnosticValueSchema = z.union([
  z.string().trim().max(300),
  z.number().finite(),
  z.boolean(),
]);
const diagnosticAttributesSchema = z.record(
  z.string().regex(/^[a-z](?:[a-z0-9_.-]|\[|\]){0,119}$/i),
  diagnosticValueSchema,
).refine((value) => Object.keys(value).length <= 96, "At most 96 diagnostic attributes are allowed");
const commonFields = {
  version: z.literal(1).default(1),
  eventId: z.string().uuid().optional(),
  idempotencyKey: optionalText(200),
  environment: cueEnvironmentSchema.optional(),
};

export const cueErrorEventSchema = z.object({
  ...commonFields,
  type: z.literal("error.occurred"),
  title: shortText(200),
  level: z.literal("error").default("error"),
  message: optionalText(2_000),
  error: safeErrorSchema.optional(),
  context: diagnosticContextSchema.optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  url: z.string().url().max(2_048).optional(),
  data: z.object({
    errorCode: optionalText(120),
    fingerprint: optionalText(200),
    component: optionalText(120),
    environment: optionalText(80),
    affectedUser: protectedIdentity.optional(),
    fatal: z.boolean().default(false),
    unhandled: z.boolean().default(false),
    attributes: diagnosticAttributesSchema.optional(),
  }).strict().default({ fatal: false, unhandled: false }),
}).strict();

const userEventFields = {
  ...commonFields,
  userId: protectedIdentity,
  occurredAt: z.string().datetime({ offset: true }).optional(),
  context: diagnosticContextSchema.optional(),
};

export const cueUserRegisteredEventSchema = z.object({
  ...userEventFields,
  type: z.literal("user.registered"),
}).strict();

export const cueUserActiveEventSchema = z.object({
  ...userEventFields,
  type: z.literal("user.active"),
}).strict();

export const cueActivityEventSchema = z.object({
  ...commonFields,
  type: z.literal("activity.occurred"),
  eventId: z.string().uuid(),
  metric: z.string().trim().min(8).max(120)
    .regex(/^custom\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,4}$/),
  userId: protectedIdentity,
  occurredAt: z.string().datetime({ offset: true }).optional(),
  context: diagnosticContextSchema.optional(),
}).strict();

export const cueTrackedEventSchema = z.object({
  ...commonFields,
  type: z.literal("activity.tracked"),
  eventId: z.string().uuid(),
  name: eventName,
  value: z.number().finite().positive().max(1_000_000_000).default(1),
  userId: protectedIdentity.optional(),
  attributes: diagnosticAttributesSchema.optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  context: diagnosticContextSchema.optional(),
}).strict();

export const cueEventSchema = z.discriminatedUnion("type", [
  cueErrorEventSchema,
  cueUserRegisteredEventSchema,
  cueUserActiveEventSchema,
  cueActivityEventSchema,
  cueTrackedEventSchema,
  cueFeatureResultSchema,
]);
type CueEvent = z.infer<typeof cueEventSchema>;
export type CueErrorEvent = z.infer<typeof cueErrorEventSchema>;
type CueUserEvent = z.infer<typeof cueUserRegisteredEventSchema> | z.infer<typeof cueUserActiveEventSchema>;
type CueActivityEvent = z.infer<typeof cueActivityEventSchema>;
type CueTrackedEvent = z.infer<typeof cueTrackedEventSchema>;

interface CueSourceRow {
  key_id: string;
  key_kind: "publishable" | "secret";
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  project_id: string | null;
  allowed_origins_json: string;
  allowed_events_json: string;
  timezone: string;
  error_cooldown_minutes: number;
  environment: CueEnvironment;
  alerts_enabled: number;
  aggregate_only_slack: number;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
}

interface StoredResult {
  eventId: string;
  queued: boolean;
  notificationSuppressed?: boolean;
  duplicate?: boolean;
  period?: string;
  classification?: "unregistered";
  requestedFeature?: string;
  requestedMetric?: string;
  githubQueued?: boolean;
}

function unregisteredMetricError(event: CueActivityEvent): CueErrorEvent {
  return cueErrorEventSchema.parse({
    version: 1,
    type: "error.occurred",
    eventId: event.eventId,
    title: "Unregistered metric received",
    message: `NoxCue received “${event.metric}”, but it is not registered for this project. Register it before sending activity events.`,
    occurredAt: event.occurredAt,
    data: {
      errorCode: "UNREGISTERED_METRIC",
      fingerprint: "metric.unregistered",
      component: event.metric,
      fatal: false,
      unhandled: false,
    },
  });
}

function unregisteredFeatureError(event: Extract<CueEvent, { type: "feature.result" }>): CueErrorEvent {
  const context = [
    `NoxCue received “${event.feature}”, but it is neither a standard feature nor a registered custom feature.`,
    event.message ? `Message: ${event.message}` : null,
    event.error ? `Error: ${[event.error.code, event.error.message].filter(Boolean).join(": ")}` : null,
  ].filter((line): line is string => Boolean(line)).join("\n").slice(0, 2_000);
  return cueErrorEventSchema.parse({
    version: 1,
    type: "error.occurred",
    eventId: event.eventId,
    idempotencyKey: event.idempotencyKey,
    title: "Unregistered feature received",
    message: context,
    occurredAt: event.occurredAt,
    data: {
      errorCode: "UNREGISTERED_FEATURE",
      fingerprint: "feature.unregistered",
      component: event.feature,
      fatal: false,
      unhandled: false,
    },
  });
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  }
  return headers;
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function rateLimited(origin: string | null): Response {
  const response = jsonResponse({ error: "rate_limited" }, 429, origin);
  response.headers.set("Retry-After", "60");
  return response;
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findSource(env: Env, providedKey: string): Promise<CueSourceRow | null> {
  if (!/^nox_(?:pub|secret)_[a-z0-9_-]{30,}$/i.test(providedKey)) return null;
  const keyHash = await hash(providedKey);
  return env.NOX_DB.prepare(
    `SELECT key.id AS key_id, key.kind AS key_kind, source.org_id, source.owner_id,
            source.id AS source_id, source.name AS source_name, source.project_id,
            source.allowed_origins_json, source.allowed_events_json, source.timezone, source.error_cooldown_minutes,
            source.environment, source.alerts_enabled, source.aggregate_only_slack,
            CASE WHEN source.alerts_enabled = 1 THEN COALESCE(
              NULLIF(alert_route.channel_id, ''),
              NULLIF(legacy_project_route.channel_id, ''),
              NULLIF(source.slack_channel_id, ''),
              NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), ''),
              NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')
            ) END AS slack_channel_id,
            CASE WHEN source.alerts_enabled = 1 THEN CASE
              WHEN NULLIF(alert_route.channel_id, '') IS NOT NULL THEN NULLIF(alert_route.connection_id, '')
              WHEN NULLIF(legacy_project_route.channel_id, '') IS NOT NULL THEN NULLIF(legacy_project_route.connection_id, '')
              WHEN NULLIF(source.slack_channel_id, '') IS NOT NULL THEN NULLIF(source.slack_connection_id, '')
              WHEN NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), '') IS NOT NULL
                THEN NULLIF(json_extract(config.data, '$.slack.noxCueConnectionId'), '')
              ELSE NULLIF(json_extract(config.data, '$.slack.fallbackConnectionId'), '')
            END END AS slack_connection_id
       FROM cue_source_keys key
       JOIN cue_sources source ON source.id = key.source_id
       LEFT JOIN config ON config.org_id = source.org_id AND config.key = 'settings'
       LEFT JOIN project_routing_settings routing_settings
         ON routing_settings.org_id = source.org_id
        AND routing_settings.project_id = source.project_id
        AND routing_settings.enabled = 1
       LEFT JOIN project_slack_routes alert_route
         ON alert_route.org_id = source.org_id
        AND alert_route.project_id = source.project_id
        AND alert_route.route_key = 'noxcue_alerts'
        AND routing_settings.enabled = 1
       LEFT JOIN project_slack_routes legacy_project_route
         ON legacy_project_route.org_id = source.org_id
        AND legacy_project_route.project_id = source.project_id
        AND legacy_project_route.route_key = 'noxcue'
        AND routing_settings.enabled = 1
      WHERE key.key_hash = ? AND key.revoked_at IS NULL
        AND (key.valid_until IS NULL OR key.valid_until > strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        AND source.enabled = 1
        AND COALESCE(json_extract(config.data, '$.apps.noxcue'), 1) != 0`,
  ).bind(keyHash).first<CueSourceRow>();
}

function parseAllowedOrigins(raw: string): string[] {
  try {
    const parsed = z.array(z.string().url().max(300)).max(20).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function parseAllowedEvents(raw: string): string[] {
  try {
    const parsed = z.array(eventName).max(100).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("unsupported_content_type");
  const rawLength = request.headers.get("Content-Length");
  if (rawLength && /^\d+$/.test(rawLength) && Number(rawLength) > MAX_BODY_BYTES) {
    throw new Error("payload_too_large");
  }
  if (!request.body) throw new Error("empty_payload");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel("payload_too_large");
      throw new Error("payload_too_large");
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("empty_payload");
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return JSON.parse(new TextDecoder().decode(body)); }
  catch { throw new Error("invalid_json"); }
}

async function eventIdFor(sourceId: string, timezone: string, environment: CueEnvironment, event: CueEvent): Promise<string> {
  if (event.type === "user.registered" || event.type === "user.active") {
    const period = event.type === "user.active"
      ? localPeriodAt(event.occurredAt ?? new Date(), timezone)
      : "lifetime";
    return `cue_user_${(await hash(`${sourceId}\u0000${environment}\u0000${event.type}\u0000${event.userId}\u0000${period}`)).slice(0, 40)}`;
  }
  if (event.type === "feature.result") {
    if (event.eventId) return event.eventId;
    if (event.idempotencyKey) return `cue_${(await hash(`${sourceId}\u0000${environment}\u0000${event.idempotencyKey}`)).slice(0, 40)}`;
    return crypto.randomUUID();
  }
  if (event.type === "activity.tracked" && event.idempotencyKey) {
    return `cue_${(await hash(`${sourceId}\u0000${environment}\u0000${event.idempotencyKey}`)).slice(0, 40)}`;
  }
  if (event.eventId) return event.eventId;
  if (event.idempotencyKey) return `cue_${(await hash(`${sourceId}\u0000${environment}\u0000${event.idempotencyKey}`)).slice(0, 40)}`;
  return crypto.randomUUID();
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildCueSlackMessage(sourceName: string, event: CueErrorEvent, occurrence: number) {
  const details = [
    event.data.errorCode ? `*Code:* \`${escapeSlack(event.data.errorCode)}\`` : null,
    event.data.component ? `*Component:* ${escapeSlack(event.data.component)}` : null,
    event.environment ? `*Environment:* ${escapeSlack(event.environment)}` : null,
    event.context?.release ? `*Release:* \`${escapeSlack(event.context.release)}\`` : null,
    event.context?.runtime ? `*Runtime:* ${escapeSlack(event.context.runtime)}` : null,
    event.message ? escapeSlack(event.message) : null,
  ].filter((line): line is string => Boolean(line));
  return {
    text: `${sourceName}: ${event.title}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:rotating_light: *${escapeSlack(event.title)}*\n${details.join("\n")}` } },
      ...(event.url ? [{
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "Open" }, url: event.url }],
      }] : []),
      { type: "context", elements: [{ type: "mrkdwn", text: `NoxCue · ${escapeSlack(sourceName)} · occurrence ${occurrence}` }] },
    ],
  };
}

function eventStatement(env: Env, source: CueSourceRow, event: CueErrorEvent, eventId: string, payload: unknown) {
  return env.NOX_DB.prepare(
    `INSERT INTO events
       (delivery_id, source, type, project_id, org, summary, payload_json, owner_id, org_id, created_at)
     VALUES (?, 'noxcue', ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(delivery_id) DO UPDATE SET
       summary = excluded.summary, payload_json = excluded.payload_json`,
  ).bind(
    eventId, event.type, source.project_id, source.owner_id, event.title,
    JSON.stringify(payload), source.owner_id, source.org_id, new Date().toISOString(),
  );
}

async function storeUserEvent(
  env: Env,
  source: CueSourceRow,
  event: CueUserEvent,
  eventId: string,
): Promise<StoredResult> {
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const period = localPeriodAt(occurredAt, source.timezone);
  const subjectHash = await hash(`${source.source_id}\u0000${event.userId}`);
  const receivedAt = new Date().toISOString();
  if (event.type === "user.registered") {
    const [registration] = await env.NOX_DB.batch([
      env.NOX_DB.prepare(
      `INSERT OR IGNORE INTO cue_user_registrations
         (org_id, source_id, subject_hash, period, occurred_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(source.org_id, source.source_id, subjectHash, period, occurredAt.toISOString(), receivedAt),
      env.NOX_DB.prepare(
        `INSERT OR IGNORE INTO cue_user_active_days
           (org_id, source_id, period, subject_hash, occurred_at, received_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(source.org_id, source.source_id, period, subjectHash, occurredAt.toISOString(), receivedAt),
    ]);
    return {
      eventId,
      queued: false,
      duplicate: Number(registration?.meta.changes ?? 0) === 0,
      period,
    };
  }
  const result = await env.NOX_DB.prepare(
      `INSERT OR IGNORE INTO cue_user_active_days
         (org_id, source_id, period, subject_hash, occurred_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(source.org_id, source.source_id, period, subjectHash, occurredAt.toISOString(), receivedAt).run();
  return { eventId, queued: false, duplicate: Number(result.meta.changes ?? 0) === 0, period };
}

async function storeActivityEvent(
  env: Env,
  source: CueSourceRow,
  event: CueActivityEvent,
  eventId: string,
  metric: ResolvedActivityMetric,
): Promise<StoredResult> {
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const period = localPeriodAt(occurredAt, source.timezone);
  const result = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO cue_activity_events
       (org_id, source_id, event_id, metric_key, subject_hash, period, occurred_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    source.org_id,
    source.source_id,
    eventId,
    metric.key,
    await hash(`${source.source_id}\u0000${event.userId}`),
    period,
    occurredAt.toISOString(),
    new Date().toISOString(),
  ).run();
  return { eventId, queued: false, duplicate: Number(result.meta.changes ?? 0) === 0, period };
}

async function storeTrackedEvent(
  env: Env,
  source: CueSourceRow,
  event: CueTrackedEvent,
  eventId: string,
): Promise<StoredResult> {
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (occurredAt.valueOf() > Date.now() + 5 * 60_000) throw new Error("invalid_occurred_at");
  const period = localPeriodAt(occurredAt, source.timezone);
  const subjectHash = event.userId ? await hash(`${source.source_id}\u0000${event.userId}`) : null;
  const result = await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO cue_tracked_events
       (org_id, source_id, event_id, name, value, subject_hash, period, attributes_json, occurred_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    source.org_id, source.source_id, eventId, event.name, event.value, subjectHash, period,
    JSON.stringify(event.attributes ?? {}), occurredAt.toISOString(), new Date().toISOString(),
  ).run();
  return { eventId, queued: false, duplicate: Number(result.meta.changes ?? 0) === 0, period };
}

function diagnoseError(event: CueErrorEvent) {
  const status = event.error?.status;
  const code = event.data.errorCode ?? event.error?.code ?? "unknown";
  if (status === 429 || /rate.?limit/i.test(code)) return {
    summary: `${event.title}: request rate was limited.`,
    possibleCauses: ["The app or a required provider exceeded a request or quota limit."],
    possibleFixes: ["Check request volume and provider quotas.", "Add bounded backoff where retrying the operation is safe."],
  };
  if (status && status >= 500) return {
    summary: `${event.title}: a server or dependency returned HTTP ${status}.`,
    possibleCauses: ["Application code failed while handling the request.", "A required dependency was unavailable or misconfigured."],
    possibleFixes: ["Inspect the matching application and provider logs.", "Check dependency status and deployed configuration.", "Compare the first affected release with the previous healthy release."],
  };
  if (/timeout|network|fetch/i.test(`${code} ${event.error?.name ?? ""}`)) return {
    summary: `${event.title}: the request did not complete normally.`,
    possibleCauses: ["A network path, DNS, TLS, CORS or an upstream dependency interrupted the request."],
    possibleFixes: ["Inspect the recorded stack and browser or edge logs.", "Verify the upstream hostname, allowed origins and timeout settings."],
  };
  return {
    summary: `${event.title}: ${code}.`,
    possibleCauses: ["The recorded component raised an unexpected application error."],
    possibleFixes: ["Inspect the sanitized stack and matching application log.", "Check the release for a recent regression.", "Add a stable error code or component if the current evidence is ambiguous."],
  };
}

async function storeError(
  env: Env,
  source: CueSourceRow,
  event: CueErrorEvent,
  eventId: string,
  githubEligible = true,
): Promise<StoredResult> {
  const existing = await env.NOX_DB.prepare(
    `SELECT delivery.id, delivery.status
       FROM events event
       LEFT JOIN transport_outbox delivery
         ON delivery.provider = 'slack' AND delivery.idempotency_key = 'noxcue:error:' || event.delivery_id
      WHERE event.delivery_id = ? AND event.source = 'noxcue'`,
  ).bind(eventId).first<{ id: string | null; status: string | null }>();
  if (existing) {
    return {
      eventId,
      queued: existing.status === "pending" || existing.status === "queued" || existing.status === "processing",
      notificationSuppressed: !existing.id,
    };
  }

  const receivedAt = new Date();
  const period = localPeriodAt(receivedAt, source.timezone);
  const normalizedEvent: CueErrorEvent = {
    ...event,
    title: redactDiagnosticText(event.title),
    message: event.message ? redactDiagnosticText(event.message) : undefined,
    error: event.error ? {
      ...event.error,
      name: event.error.name ? redactDiagnosticText(event.error.name) : undefined,
      message: redactDiagnosticText(event.error.message),
      code: event.error.code ? redactDiagnosticText(event.error.code) : undefined,
      stack: event.error.stack ? redactDiagnosticText(event.error.stack) : undefined,
    } : undefined,
    url: sanitizeDiagnosticUrl(event.url),
    context: { ...event.context, environment: source.environment, url: sanitizeDiagnosticUrl(event.context?.url) },
    data: { ...event.data, environment: source.environment },
  };
  const fingerprint = errorIncidentKey(normalizedEvent);
  const group = await env.NOX_DB.prepare(
    `SELECT occurrence_count, last_notified_at FROM cue_error_groups
      WHERE source_id = ? AND fingerprint = ?`,
  ).bind(source.source_id, fingerprint).first<{ occurrence_count: number; last_notified_at: string | null }>();
  const cooldownMs = source.error_cooldown_minutes * 60_000;
  const shouldNotify = source.aggregate_only_slack !== 1 && Boolean(source.slack_channel_id) && (
    !group?.last_notified_at || receivedAt.valueOf() - Date.parse(group.last_notified_at) >= cooldownMs
  );
  const occurrence = (group?.occurrence_count ?? 0) + 1;
  const payload = { ...normalizedEvent, data: { ...normalizedEvent.data, fingerprint },
    eventId, sourceId: source.source_id, source: source.source_name };
  const statements = [
    eventStatement(env, source, normalizedEvent, eventId, payload),
    env.NOX_DB.prepare(
      `INSERT INTO cue_error_groups
         (org_id, source_id, fingerprint, title, error_code, component, environment,
          first_seen_at, last_seen_at, occurrence_count, last_notified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(source_id, fingerprint) DO UPDATE SET
         title = excluded.title, error_code = excluded.error_code,
         component = excluded.component, environment = excluded.environment,
         last_seen_at = excluded.last_seen_at,
         occurrence_count = cue_error_groups.occurrence_count + 1,
         last_notified_at = COALESCE(excluded.last_notified_at, cue_error_groups.last_notified_at)`,
    ).bind(
      source.org_id, source.source_id, fingerprint, normalizedEvent.title, normalizedEvent.data.errorCode ?? null,
      normalizedEvent.data.component ?? null, normalizedEvent.data.environment ?? null,
      receivedAt.toISOString(), receivedAt.toISOString(), shouldNotify ? receivedAt.toISOString() : null,
    ),
    env.NOX_DB.prepare(
      `INSERT INTO cue_error_daily_groups
         (org_id, source_id, period, fingerprint, occurrence_count, fatal_count, unhandled_count)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(source_id, period, fingerprint) DO UPDATE SET
         occurrence_count = cue_error_daily_groups.occurrence_count + 1,
         fatal_count = cue_error_daily_groups.fatal_count + excluded.fatal_count,
         unhandled_count = cue_error_daily_groups.unhandled_count + excluded.unhandled_count`,
    ).bind(source.org_id, source.source_id, period, fingerprint, normalizedEvent.data.fatal ? 1 : 0, normalizedEvent.data.unhandled ? 1 : 0),
  ];
  if (event.data.affectedUser) {
    statements.push(env.NOX_DB.prepare(
      `INSERT OR IGNORE INTO cue_error_daily_users (org_id, source_id, period, user_hash)
       VALUES (?, ?, ?, ?)`,
    ).bind(source.org_id, source.source_id, period, await hash(event.data.affectedUser)));
  }

  await env.NOX_DB.batch(statements);
  const diagnosis = diagnoseError(normalizedEvent);
  const slackPublication = shouldNotify && source.slack_channel_id && source.project_id
    ? publishSlackTransport({ DB: env.NOX_DB, TASK_QUEUE: env.NOX_TASKS }, {
        orgId: source.org_id,
        projectId: source.project_id,
        route: "incidents",
        routeContext: { kind: "source", id: source.source_id },
        idempotencyKey: `noxcue:error:${eventId}`,
        message: buildCueSlackMessage(source.source_name, normalizedEvent, occurrence),
      })
    : Promise.resolve(null);
  const [queued, githubQueued] = await Promise.all([
    slackPublication.then((publication) => publication?.queued ?? false),
    githubEligible && source.aggregate_only_slack !== 1 ? stageGithubIncident(env, source, {
      key: fingerprint,
      kind: "error",
      title: normalizedEvent.title,
      occurredAt: normalizedEvent.occurredAt ?? receivedAt.toISOString(),
      payload: {
        impact: normalizedEvent.message ?? "An explicit application error was detected.",
        message: normalizedEvent.message,
        error: normalizedEvent.error,
        context: normalizedEvent.context,
        diagnosis,
      },
    }) : Promise.resolve(false),
  ]);
  return { eventId, queued, githubQueued, notificationSuppressed: !shouldNotify };
}

function inputError(error: unknown): { code: string; status: number } {
  if (error instanceof z.ZodError) return { code: "invalid_event", status: 400 };
  const code = error instanceof Error ? error.message : "internal_error";
  switch (code) {
    case "unsupported_content_type": return { code, status: 415 };
    case "empty_payload":
    case "invalid_json":
    case "invalid_occurred_at":
      return { code, status: 400 };
    case "payload_too_large": return { code, status: 413 };
    default: return { code: "internal_error", status: 500 };
  }
}

export async function handleCueEvent(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    if (!origin) return jsonResponse({ error: "origin_required" }, 400, null);
    const headers = corsHeaders(origin);
    headers.set("Access-Control-Allow-Headers", "content-type, x-nox-ingest-key");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "3600");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const ipLimit = await env.CUE_IP_RATE_LIMITER.limit({ key: `cue:${ip}` });
  if (!ipLimit.success) return rateLimited(origin);
  const providedKey = request.headers.get("X-Nox-Ingest-Key")?.trim() ?? "";
  const source = await findSource(env, providedKey);
  if (!source) return jsonResponse({ error: "invalid_ingest_key" }, 401, origin);
  if (origin && source.key_kind === "secret") {
    return jsonResponse({ error: "secret_key_not_allowed_from_browser" }, 403, origin);
  }
  if (origin && !parseAllowedOrigins(source.allowed_origins_json).includes(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
  }

  try {
    const parsedEvent = cueEventSchema.parse(await readJsonBody(request));
    const legacyEnvironment = parsedEvent.type === "error.occurred" ? parsedEvent.data.environment : undefined;
    const suppliedEnvironment = parsedEvent.environment ?? legacyEnvironment;
    if (suppliedEnvironment && suppliedEnvironment !== source.environment) {
      return jsonResponse({
        error: "environment_mismatch",
        expectedEnvironment: source.environment,
        receivedEnvironment: suppliedEnvironment,
      }, 409, origin);
    }
    const event = parsedEvent.type === "error.occurred"
      ? { ...parsedEvent, environment: source.environment, data: { ...parsedEvent.data, environment: source.environment } }
      : { ...parsedEvent, environment: source.environment };
    const isUserEvent = event.type === "user.registered" || event.type === "user.active";
    const isFeatureEvent = event.type === "feature.result";
    const isActivityEvent = event.type === "activity.occurred";
    const isTrackedEvent = event.type === "activity.tracked";
    if ((isUserEvent || isActivityEvent) && source.key_kind !== "secret") {
      return jsonResponse({ error: "secret_key_required" }, 403, origin);
    }
    if ((isFeatureEvent || isTrackedEvent || event.type === "error.occurred") && source.key_kind === "publishable" && !origin) {
      return jsonResponse({ error: "origin_required" }, 403, null);
    }
    if (event.type === "error.occurred" && event.data.fingerprint && source.key_kind !== "secret") {
      return jsonResponse({ error: "explicit_incident_key_requires_secret_key" }, 403, origin);
    }
    if (isTrackedEvent) {
      if (source.key_kind === "publishable") {
        if (event.userId) return jsonResponse({ error: "identity_not_allowed" }, 403, origin);
        if (!event.name.startsWith("website.") || !parseAllowedEvents(source.allowed_events_json).includes(event.name)) {
          return jsonResponse({ error: "event_not_allowed" }, 403, origin);
        }
      } else if (!event.name.startsWith("website.") && !event.userId) {
        return jsonResponse({ error: "protected_identity_required" }, 400, origin);
      }
    }
    const [sourceLimit, orgLimit] = await Promise.all([
      isUserEvent || isFeatureEvent || isActivityEvent || isTrackedEvent
        ? env.CUE_USER_EVENT_RATE_LIMITER.limit({ key: `source:${source.source_id}` })
        : env.CUE_ERROR_RATE_LIMITER.limit({ key: `source:${source.source_id}` }),
      isUserEvent || isFeatureEvent || isActivityEvent || isTrackedEvent
        ? Promise.resolve({ success: true })
        : env.CUE_ORG_RATE_LIMITER.limit({ key: `org:${source.org_id}` }),
    ]);
    if (!sourceLimit.success || !orgLimit.success) return rateLimited(origin);
    const eventId = await eventIdFor(source.source_id, source.timezone, source.environment, event);
    const definition = isFeatureEvent ? await resolveFeature(env, {
      orgId: source.org_id,
      sourceId: source.source_id,
      projectId: source.project_id,
    }, event.feature) : null;
    const activityMetric = isActivityEvent ? await resolveActivityMetric(env, {
      orgId: source.org_id,
      sourceId: source.source_id,
      projectId: source.project_id,
    }, event.metric) : null;
    const result = isUserEvent
      ? await storeUserEvent(env, source, event, eventId)
      : isActivityEvent
        ? activityMetric
          ? await storeActivityEvent(env, source, event, eventId, activityMetric)
          : {
              ...await storeError(env, source, unregisteredMetricError(event), eventId, false),
              classification: "unregistered" as const,
              requestedMetric: event.metric,
            }
      : isTrackedEvent
        ? await storeTrackedEvent(env, source, event, eventId)
      : isFeatureEvent
        ? definition
          ? await storeFeatureResult(env, source, event, eventId, definition)
          : {
              ...await storeError(env, source, unregisteredFeatureError(event), eventId, false),
              classification: "unregistered" as const,
              requestedFeature: event.feature,
            }
        : await storeError(env, source, event, eventId);
    await env.NOX_DB.prepare(
      `UPDATE cue_source_keys SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL`,
    ).bind(new Date().toISOString(), source.key_id).run();
    await env.NOX_DB.prepare(
      `INSERT INTO cue_source_key_daily_usage
         (org_id, source_id, key_id, period, request_count, first_used_at, last_used_at)
       VALUES (?, ?, ?, date('now'), 1, ?, ?)
       ON CONFLICT(key_id, period) DO UPDATE SET
         request_count = cue_source_key_daily_usage.request_count + 1,
         last_used_at = excluded.last_used_at`,
    ).bind(source.org_id, source.source_id, source.key_id, new Date().toISOString(), new Date().toISOString()).run();
    return jsonResponse({ accepted: true, stored: true, environment: source.environment, ...result }, 202, origin);
  } catch (error) {
    const { code, status } = inputError(error);
    if (status === 500) {
      console.error(JSON.stringify({
        message: "NoxCue event ingestion failed",
        sourceId: source.source_id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    return jsonResponse({ error: code }, status, origin);
  }
}
