import { z } from "zod";
import { localPeriodAt } from "./metrics";

const MAX_BODY_BYTES = 32_768;
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const commonFields = {
  version: z.literal(1).default(1),
  eventId: z.string().uuid().optional(),
  idempotencyKey: optionalText(200),
};

export const cueErrorEventSchema = z.object({
  ...commonFields,
  type: z.literal("error.occurred"),
  title: shortText(200),
  level: z.literal("error").default("error"),
  message: optionalText(2_000),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  url: z.string().url().max(2_048).optional(),
  data: z.object({
    errorCode: optionalText(120),
    fingerprint: optionalText(200),
    component: optionalText(120),
    environment: optionalText(80),
    affectedUser: optionalText(200),
    fatal: z.boolean().default(false),
    unhandled: z.boolean().default(false),
  }).strict().default({ fatal: false, unhandled: false }),
}).strict();

const userEventFields = {
  ...commonFields,
  userId: shortText(200),
  occurredAt: z.string().datetime({ offset: true }).optional(),
};

export const cueUserRegisteredEventSchema = z.object({
  ...userEventFields,
  type: z.literal("user.registered"),
}).strict();

export const cueUserActiveEventSchema = z.object({
  ...userEventFields,
  type: z.literal("user.active"),
}).strict();

export const cueEventSchema = z.discriminatedUnion("type", [
  cueErrorEventSchema,
  cueUserRegisteredEventSchema,
  cueUserActiveEventSchema,
]);
export type CueEvent = z.infer<typeof cueEventSchema>;
export type CueErrorEvent = z.infer<typeof cueErrorEventSchema>;
export type CueUserEvent = z.infer<typeof cueUserRegisteredEventSchema> | z.infer<typeof cueUserActiveEventSchema>;

interface CueSourceRow {
  key_id: string;
  key_kind: "publishable" | "secret";
  org_id: number;
  owner_id: string;
  source_id: string;
  source_name: string;
  project_id: string | null;
  allowed_origins_json: string;
  timezone: string;
  error_cooldown_minutes: number;
  slack_channel_id: string | null;
  slack_connection_id: string | null;
}

interface SlackTask {
  type: "deliver_slack";
  outboxId: string;
  ownerId: string;
  deliveryId: string;
}

interface StoredResult {
  eventId: string;
  queued: boolean;
  notificationSuppressed?: boolean;
  duplicate?: boolean;
  period?: string;
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
            source.allowed_origins_json, source.timezone, source.error_cooldown_minutes,
            COALESCE(
              NULLIF(json_extract(config.data, '$.slack.noxCueChannelId'), ''),
              NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')
            ) AS slack_channel_id,
            COALESCE(
              NULLIF(json_extract(config.data, '$.slack.noxCueConnectionId'), ''),
              NULLIF(json_extract(config.data, '$.slack.fallbackConnectionId'), '')
            ) AS slack_connection_id
       FROM cue_source_keys key
       JOIN cue_sources source ON source.id = key.source_id
       LEFT JOIN config ON config.org_id = source.org_id AND config.key = 'settings'
      WHERE key.key_hash = ? AND key.revoked_at IS NULL AND source.enabled = 1
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

async function eventIdFor(sourceId: string, timezone: string, event: CueEvent): Promise<string> {
  if (event.type === "user.registered" || event.type === "user.active") {
    const period = event.type === "user.active"
      ? localPeriodAt(event.occurredAt ?? new Date(), timezone)
      : "lifetime";
    return `cue_user_${(await hash(`${sourceId}\u0000${event.type}\u0000${event.userId}\u0000${period}`)).slice(0, 40)}`;
  }
  if (event.eventId) return event.eventId;
  if (event.idempotencyKey) return `cue_${(await hash(`${sourceId}\u0000${event.idempotencyKey}`)).slice(0, 40)}`;
  return crypto.randomUUID();
}

async function fingerprintFor(sourceId: string, event: CueErrorEvent): Promise<string> {
  if (event.data.fingerprint) return event.data.fingerprint;
  const basis = [sourceId, event.data.environment, event.data.component, event.data.errorCode, event.title]
    .map((part) => part?.trim().toLowerCase() ?? "")
    .join("\u0000");
  return `err_${(await hash(basis)).slice(0, 40)}`;
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildCueSlackMessage(sourceName: string, event: CueErrorEvent, occurrence: number) {
  const details = [
    event.data.errorCode ? `*Code:* \`${escapeSlack(event.data.errorCode)}\`` : null,
    event.data.component ? `*Component:* ${escapeSlack(event.data.component)}` : null,
    event.data.environment ? `*Environment:* ${escapeSlack(event.data.environment)}` : null,
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

async function queueDelivery(env: Env, source: CueSourceRow, eventId: string, deliveryId: string): Promise<boolean> {
  try {
    const task: SlackTask = { type: "deliver_slack", outboxId: deliveryId, ownerId: source.owner_id, deliveryId };
    await env.NOX_TASKS.send(task);
    await env.NOX_DB.prepare(
      `UPDATE delivery_outbox SET status = 'queued',
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status IN ('pending', 'retrying', 'failed')`,
    ).bind(deliveryId).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "NoxCue queue send failed; NoxConnect recovery will retry",
      eventId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return false;
  }
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

async function storeError(env: Env, source: CueSourceRow, event: CueErrorEvent, eventId: string): Promise<StoredResult> {
  const existing = await env.NOX_DB.prepare(
    `SELECT delivery.id, delivery.status
       FROM events event
       LEFT JOIN delivery_outbox delivery
         ON delivery.source = 'noxcue' AND delivery.source_id = event.delivery_id
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
  const fingerprint = await fingerprintFor(source.source_id, event);
  const group = await env.NOX_DB.prepare(
    `SELECT occurrence_count, last_notified_at FROM cue_error_groups
      WHERE source_id = ? AND fingerprint = ?`,
  ).bind(source.source_id, fingerprint).first<{ occurrence_count: number; last_notified_at: string | null }>();
  const cooldownMs = source.error_cooldown_minutes * 60_000;
  const shouldNotify = Boolean(source.slack_channel_id) && (
    !group?.last_notified_at || receivedAt.valueOf() - Date.parse(group.last_notified_at) >= cooldownMs
  );
  const occurrence = (group?.occurrence_count ?? 0) + 1;
  const payload = { ...event, data: { ...event.data, fingerprint }, eventId, sourceId: source.source_id, source: source.source_name };
  const statements = [
    eventStatement(env, source, event, eventId, payload),
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
      source.org_id, source.source_id, fingerprint, event.title, event.data.errorCode ?? null,
      event.data.component ?? null, event.data.environment ?? null,
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
    ).bind(source.org_id, source.source_id, period, fingerprint, event.data.fatal ? 1 : 0, event.data.unhandled ? 1 : 0),
  ];
  if (event.data.affectedUser) {
    statements.push(env.NOX_DB.prepare(
      `INSERT OR IGNORE INTO cue_error_daily_users (org_id, source_id, period, user_hash)
       VALUES (?, ?, ?, ?)`,
    ).bind(source.org_id, source.source_id, period, await hash(event.data.affectedUser)));
  }

  let deliveryId: string | null = null;
  if (shouldNotify && source.slack_channel_id) {
    deliveryId = crypto.randomUUID();
    statements.push(env.NOX_DB.prepare(
      `INSERT INTO delivery_outbox
         (id, org_id, source, source_id, destination, site_id, slack_connection_id,
          channel_id, payload_json, status)
       VALUES (?, ?, 'noxcue', ?, 'slack', NULL, ?, ?, ?, 'pending')`,
    ).bind(
      deliveryId, source.org_id, eventId, source.slack_connection_id, source.slack_channel_id,
      JSON.stringify({ message: buildCueSlackMessage(source.source_name, event, occurrence) }),
    ));
  }
  await env.NOX_DB.batch(statements);
  const queued = deliveryId ? await queueDelivery(env, source, eventId, deliveryId) : false;
  return { eventId, queued, notificationSuppressed: !shouldNotify };
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
  if (origin && !parseAllowedOrigins(source.allowed_origins_json).includes(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
  }

  try {
    const event = cueEventSchema.parse(await readJsonBody(request));
    const isUserEvent = event.type === "user.registered" || event.type === "user.active";
    if (isUserEvent && source.key_kind !== "secret") {
      return jsonResponse({ error: "secret_key_required" }, 403, origin);
    }
    const [sourceLimit, orgLimit] = await Promise.all([
      isUserEvent
        ? env.CUE_USER_EVENT_RATE_LIMITER.limit({ key: `source:${source.source_id}` })
        : env.CUE_ERROR_RATE_LIMITER.limit({ key: `source:${source.source_id}` }),
      isUserEvent
        ? Promise.resolve({ success: true })
        : env.CUE_ORG_RATE_LIMITER.limit({ key: `org:${source.org_id}` }),
    ]);
    if (!sourceLimit.success || !orgLimit.success) return rateLimited(origin);
    const eventId = await eventIdFor(source.source_id, source.timezone, event);
    const result = isUserEvent
      ? await storeUserEvent(env, source, event, eventId)
      : await storeError(env, source, event, eventId);
    await env.NOX_DB.prepare(
      `UPDATE cue_source_keys SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL`,
    ).bind(new Date().toISOString(), source.key_id).run();
    return jsonResponse({ accepted: true, stored: true, ...result }, 202, origin);
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
