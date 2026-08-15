import { z } from "zod";
import type { NoxSlackDeliveryTask } from "./canary";

const MAX_ERROR_BODY_BYTES = 32_768;
const ERROR_SOURCE = "noxalert_error";

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const tagsSchema = z.record(z.string().min(1).max(64), z.string().max(256)).superRefine((tags, ctx) => {
  if (Object.keys(tags).length > 20) {
    ctx.addIssue({ code: "custom", message: "At most 20 tags are allowed" });
  }
});

export const browserErrorSchema = z.object({
  version: z.literal(1).default(1),
  eventId: z.string().uuid().optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  service: shortText(120),
  environment: shortText(64),
  release: optionalText(120),
  error: z.object({
    type: shortText(160),
    message: shortText(2_000),
    stack: optionalText(12_000),
  }).strict(),
  page: z.object({
    url: z.string().url().max(2_048).optional(),
    route: optionalText(512),
  }).strict().optional(),
  trace: z.object({
    traceId: z.string().regex(/^[0-9a-f]{32}$/i),
    spanId: z.string().regex(/^[0-9a-f]{16}$/i).optional(),
  }).strict().optional(),
  tags: tagsSchema.optional(),
}).strict();

export type BrowserError = z.infer<typeof browserErrorSchema>;

const filterFieldSchema = z.enum([
  "service",
  "environment",
  "release",
  "error.type",
  "error.message",
  "page.url",
  "page.route",
]);

export const errorFilterConditionSchema = z.object({
  field: filterFieldSchema,
  operator: z.enum(["equals", "starts_with", "contains"]),
  value: shortText(256),
}).strict();

export const errorFilterSchema = z.object({
  environments: z.array(shortText(64)).max(20).default([]),
  services: z.array(shortText(120)).max(50).default([]),
  include: z.array(errorFilterConditionSchema).max(20).default([]),
  exclude: z.array(errorFilterConditionSchema).max(20).default([]),
}).strict();

export type ErrorFilter = z.infer<typeof errorFilterSchema>;

const originSchema = z.string().url().max(300).refine((value) => {
  const url = new URL(value);
  return value === url.origin;
}, "Use an exact origin without a path, for example https://app.example.com");

export const projectErrorSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  allowedOrigins: z.array(originSchema).max(20),
}).strict();

export const errorRuleInputSchema = z.object({
  name: shortText(120),
  enabled: z.boolean().default(true),
  filters: errorFilterSchema,
  notifyAfterCount: z.number().int().min(1).max(10_000).default(1),
  windowSeconds: z.number().int().min(60).max(86_400).default(300),
  repeatAfterSeconds: z.number().int().min(60).max(604_800).default(900),
}).strict();

export interface IngestKeyRow {
  id: string;
  org_id: number;
  owner_id: string;
  project_id: string;
  allowed_origins_json: string;
}

interface ErrorRuleRow {
  id: string;
  name: string;
  filters_json: string;
  threshold: number;
  window_seconds: number;
  repeat_after_seconds: number;
  slack_channel_id: string;
}

const storedErrorRuleSchema = z.object({
  id: shortText(100),
  name: shortText(120),
  filters_json: z.string().min(2).max(20_000),
  threshold: z.number().int().min(1).max(10_000),
  window_seconds: z.number().int().min(60).max(86_400),
  repeat_after_seconds: z.number().int().min(60).max(604_800),
  slack_channel_id: shortText(100),
}).strict();

interface ErrorGroupRow {
  occurrence_count: number;
  pending_delivery_id: string | null;
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

export async function hashPublicKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseAllowedOrigins(raw: string): string[] {
  try {
    const parsed = z.array(originSchema).max(20).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function isProjectOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  return origin === null || allowedOrigins.includes(origin);
}

function fieldValue(error: BrowserError, field: z.infer<typeof filterFieldSchema>): string {
  switch (field) {
    case "service": return error.service;
    case "environment": return error.environment;
    case "release": return error.release ?? "";
    case "error.type": return error.error.type;
    case "error.message": return error.error.message;
    case "page.url": return error.page?.url ?? "";
    case "page.route": return error.page?.route ?? "";
  }
}

function conditionMatches(error: BrowserError, condition: z.infer<typeof errorFilterConditionSchema>): boolean {
  const actual = fieldValue(error, condition.field).toLowerCase();
  const expected = condition.value.toLowerCase();
  switch (condition.operator) {
    case "equals": return actual === expected;
    case "starts_with": return actual.startsWith(expected);
    case "contains": return actual.includes(expected);
  }
}

export function matchesErrorFilter(error: BrowserError, filter: ErrorFilter): boolean {
  const environments = filter.environments.map((value) => value.toLowerCase());
  if (environments.length > 0 && !environments.includes(error.environment.toLowerCase())) return false;
  const services = filter.services.map((value) => value.toLowerCase());
  if (services.length > 0 && !services.includes(error.service.toLowerCase())) return false;
  if (!filter.include.every((condition) => conditionMatches(error, condition))) return false;
  return !filter.exclude.some((condition) => conditionMatches(error, condition));
}

function normalizeFingerprintPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<number>")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fingerprintError(error: BrowserError, ruleId: string): Promise<string> {
  const firstFrame = error.error.stack?.split("\n").slice(1).find((line) => line.trim()) ?? "";
  return hashPublicKey([
    ruleId,
    error.service,
    error.environment,
    error.error.type,
    normalizeFingerprintPart(error.error.message),
    normalizeFingerprintPart(firstFrame),
  ].join("\u0000"));
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildErrorSlackMessage(
  error: BrowserError,
  rule: Pick<ErrorRuleRow, "name">,
  count: number,
  fingerprint: string,
): string {
  const lines = [
    `:rotating_light: *NoxAlert — ${escapeSlack(rule.name)}*`,
    `*Service:* \`${escapeSlack(error.service)}\``,
    `*Environment:* \`${escapeSlack(error.environment)}\``,
    `*Error:* ${escapeSlack(error.error.type)} — ${escapeSlack(error.error.message)}`,
    `*Occurrences:* ${count}`,
    `*Fingerprint:* \`${fingerprint.slice(0, 12)}\``,
  ];
  if (error.release) lines.push(`*Release:* \`${escapeSlack(error.release)}\``);
  if (error.page?.url) lines.push(`*Page:* ${escapeSlack(error.page.url)}`);
  return lines.join("\n");
}

export async function findIngestKey(env: Env, provided: string): Promise<IngestKeyRow | null> {
  if (!/^nox_[a-z0-9_-]{20,}$/i.test(provided)) return null;
  const hash = await hashPublicKey(provided);
  return env.NOX_DB.prepare(
    `SELECT key.id, key.org_id, key.owner_id, key.project_id, settings.allowed_origins_json
       FROM alert_api_keys key
       JOIN alert_project_settings settings ON settings.project_id = key.project_id
      WHERE key.key_hash = ? AND key.revoked_at IS NULL AND settings.enabled = 1`,
  ).bind(hash).first<IngestKeyRow>();
}

/** Read a bounded JSON request body. Shared by the browser and OTLP ingest paths. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("unsupported_content_type");
  const rawLength = request.headers.get("Content-Length");
  if (rawLength && /^\d+$/.test(rawLength) && Number(rawLength) > maxBytes) {
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
    if (total > maxBytes) {
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
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error("invalid_json");
  }
}

async function recordOccurrence(
  env: Env,
  rule: ErrorRuleRow,
  fingerprint: string,
  error: BrowserError,
  now: Date,
): Promise<ErrorGroupRow> {
  const nowIso = now.toISOString();
  const windowCutoff = new Date(now.getTime() - rule.window_seconds * 1_000).toISOString();
  const row = await env.NOX_DB.prepare(
    `INSERT INTO alert_error_groups
       (rule_id, fingerprint, occurrence_count, window_started_at, first_seen_at,
        last_seen_at, last_notified_at, pending_delivery_id, sample_json)
     VALUES (?, ?, 1, ?, ?, ?, NULL, NULL, ?)
     ON CONFLICT(rule_id, fingerprint) DO UPDATE SET
       occurrence_count = CASE
         WHEN alert_error_groups.window_started_at <= ? THEN 1
         ELSE alert_error_groups.occurrence_count + 1
       END,
       window_started_at = CASE
         WHEN alert_error_groups.window_started_at <= ? THEN excluded.window_started_at
         ELSE alert_error_groups.window_started_at
       END,
       last_seen_at = excluded.last_seen_at,
       sample_json = excluded.sample_json
     RETURNING occurrence_count, pending_delivery_id`,
  ).bind(
    rule.id,
    fingerprint,
    nowIso,
    nowIso,
    nowIso,
    JSON.stringify(error),
    windowCutoff,
    windowCutoff,
  ).first<ErrorGroupRow>();
  if (!row) throw new Error("error_group_write_failed");
  return row;
}

async function claimDelivery(
  env: Env,
  rule: ErrorRuleRow,
  fingerprint: string,
  now: Date,
): Promise<string | null> {
  const deliveryId = crypto.randomUUID();
  const repeatCutoff = new Date(now.getTime() - rule.repeat_after_seconds * 1_000).toISOString();
  const row = await env.NOX_DB.prepare(
    `UPDATE alert_error_groups
        SET pending_delivery_id = COALESCE(pending_delivery_id, ?),
            last_notified_at = CASE
              WHEN pending_delivery_id IS NULL THEN ? ELSE last_notified_at
            END
      WHERE rule_id = ? AND fingerprint = ?
        AND (
          pending_delivery_id IS NOT NULL
          OR (occurrence_count >= ? AND (last_notified_at IS NULL OR last_notified_at <= ?))
        )
      RETURNING pending_delivery_id`,
  ).bind(
    deliveryId,
    now.toISOString(),
    rule.id,
    fingerprint,
    Math.max(1, Math.floor(rule.threshold)),
    repeatCutoff,
  ).first<{ pending_delivery_id: string }>();
  return row?.pending_delivery_id ?? null;
}

async function persistAndQueueDelivery(
  env: Env,
  key: IngestKeyRow,
  rule: ErrorRuleRow,
  deliveryId: string,
  message: string,
): Promise<void> {
  await env.NOX_DB.prepare(
    `INSERT OR IGNORE INTO delivery_outbox
       (id, org_id, source, source_id, destination, site_id, channel_id, payload_json, status)
     VALUES (?, ?, ?, ?, 'slack', NULL, ?, ?, 'pending')`,
  ).bind(
    deliveryId,
    key.org_id,
    ERROR_SOURCE,
    deliveryId,
    rule.slack_channel_id,
    JSON.stringify({ message: { text: message } }),
  ).run();

  try {
    const task: NoxSlackDeliveryTask = {
      type: "deliver_slack",
      outboxId: deliveryId,
      ownerId: key.owner_id,
      deliveryId,
    };
    await env.NOX_TASKS.send(task);
    await env.NOX_DB.prepare(
      `UPDATE delivery_outbox SET status = 'queued',
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending'`,
    ).bind(deliveryId).run();
  } catch (error) {
    console.error(JSON.stringify({
      message: "error alert queue send failed; Unticket recovery will retry",
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    }));
  } finally {
    await env.NOX_DB.prepare(
      `UPDATE alert_error_groups SET pending_delivery_id = NULL
        WHERE rule_id = ? AND pending_delivery_id = ?`,
    ).bind(rule.id, deliveryId).run();
  }
}

/**
 * Run one error through every enabled rule for its project: filter, group,
 * threshold, repeat-suppress, deliver. This is the whole "alert or not"
 * decision — both the browser endpoint and the OTLP endpoint call it, so the
 * ingest shape never gets a say in the outcome. Returns how many rules matched.
 */
export async function evaluateError(
  env: Env,
  key: IngestKeyRow,
  error: BrowserError,
  now: Date,
): Promise<number> {
  const { results } = await env.NOX_DB.prepare(
    `SELECT rule.id, rule.name, rule.filters_json, rule.notify_after_count AS threshold,
            rule.window_seconds, rule.repeat_after_seconds,
            COALESCE(
              NULLIF(json_extract(config.data, '$.slack.noxAlertChannelId'), ''),
              NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')
            ) AS slack_channel_id
       FROM alert_error_rules rule
       JOIN config ON config.org_id = rule.org_id AND config.key = 'settings'
      WHERE rule.project_id = ? AND rule.enabled = 1
        AND COALESCE(
          NULLIF(json_extract(config.data, '$.slack.noxAlertChannelId'), ''),
          NULLIF(json_extract(config.data, '$.slack.fallbackChannelId'), '')
        ) IS NOT NULL
      ORDER BY rule.created_at
      LIMIT 50`,
  ).bind(key.project_id).all<ErrorRuleRow>();

  let matchedRules = 0;
  for (const rawRule of results ?? []) {
    const parsedRule = storedErrorRuleSchema.safeParse(rawRule);
    if (!parsedRule.success) {
      console.error(JSON.stringify({ message: "invalid stored error rule", ruleId: rawRule.id }));
      continue;
    }
    const rule: ErrorRuleRow = parsedRule.data;
    let storedFilter: unknown;
    try {
      storedFilter = JSON.parse(rule.filters_json);
    } catch {
      storedFilter = null;
    }
    const parsedFilter = errorFilterSchema.safeParse(storedFilter);
    if (!parsedFilter.success) {
      console.error(JSON.stringify({ message: "invalid stored error filter", ruleId: rule.id }));
      continue;
    }
    if (!matchesErrorFilter(error, parsedFilter.data)) continue;
    matchedRules += 1;
    const fingerprint = await fingerprintError(error, rule.id);
    const group = await recordOccurrence(env, rule, fingerprint, error, now);
    const deliveryId = await claimDelivery(env, rule, fingerprint, now);
    if (!deliveryId) continue;
    await persistAndQueueDelivery(
      env,
      key,
      rule,
      deliveryId,
      buildErrorSlackMessage(error, rule, group.occurrence_count, fingerprint),
    );
  }
  return matchedRules;
}

export async function touchIngestKey(env: Env, key: IngestKeyRow, now: Date): Promise<void> {
  await env.NOX_DB.prepare(
    `UPDATE alert_api_keys SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL`,
  ).bind(now.toISOString(), key.id).run();
}

export function errorStatus(error: unknown): { code: string; status: number } {
  if (error instanceof z.ZodError) return { code: "invalid_error", status: 400 };
  const code = error instanceof Error ? error.message : "internal_error";
  switch (code) {
    case "unsupported_content_type": return { code, status: 415 };
    case "empty_payload": return { code, status: 400 };
    case "invalid_json": return { code, status: 400 };
    case "payload_too_large": return { code, status: 413 };
    default: return { code: "internal_error", status: 500 };
  }
}

export async function handleBrowserError(request: Request, env: Env): Promise<Response> {
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
  const ipLimit = await env.ERROR_IP_RATE_LIMITER.limit({ key: `error:${ip}` });
  if (!ipLimit.success) return rateLimited(origin);

  const providedKey = request.headers.get("X-Nox-Ingest-Key")?.trim() ?? "";
  const key = await findIngestKey(env, providedKey);
  if (!key) return jsonResponse({ error: "invalid_ingest_key" }, 401, origin);
  if (!isProjectOriginAllowed(origin, parseAllowedOrigins(key.allowed_origins_json))) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
  }

  const projectLimit = await env.ERROR_PROJECT_RATE_LIMITER.limit({ key: `project:${key.project_id}` });
  if (!projectLimit.success) return rateLimited(origin);

  let error: BrowserError;
  try {
    error = browserErrorSchema.parse(await readJsonBody(request, MAX_ERROR_BODY_BYTES));
  } catch (cause) {
    const { code, status } = errorStatus(cause);
    return jsonResponse({ error: code }, status, origin);
  }

  const now = new Date();
  const matchedRules = await evaluateError(env, key, error, now);
  await touchIngestKey(env, key, now);

  return jsonResponse({ accepted: true, eventId: error.eventId ?? crypto.randomUUID(), matchedRules }, 202, origin);
}
