import { z } from "zod";
import {
  browserErrorSchema,
  errorStatus,
  evaluateError,
  findIngestKey,
  readJsonBody,
  touchIngestKey,
  type BrowserError,
} from "./errors";

const MAX_OTLP_BODY_BYTES = 512 * 1024;
const MAX_OTLP_RECORDS = 500;
const MAX_TAGS = 20;
const MAX_TAG_KEY = 64;
const MAX_TAG_VALUE = 256;

/**
 * Attribute keys that already have a home on the error shape, so they must not
 * be duplicated into tags.
 */
const MAPPED_ATTRIBUTE_KEYS = new Set([
  "error.type",
  "error.message",
  "exception.type",
  "exception.message",
  "exception.stacktrace",
]);

/**
 * OTLP/HTTP JSON, decoded loosely on purpose: unknown fields are stripped
 * rather than rejected so a collector upgrade never turns into a 400 and a
 * retry storm. Anything we cannot map is dropped per-record instead.
 */
const anyValueSchema = z.object({
  stringValue: z.string().optional(),
  boolValue: z.boolean().optional(),
  intValue: z.union([z.string(), z.number()]).optional(),
  doubleValue: z.number().optional(),
});

const keyValueSchema = z.object({
  key: z.string(),
  value: anyValueSchema.optional(),
});

const logRecordSchema = z.object({
  timeUnixNano: z.union([z.string(), z.number()]).optional(),
  observedTimeUnixNano: z.union([z.string(), z.number()]).optional(),
  severityText: z.string().optional(),
  body: anyValueSchema.optional(),
  attributes: z.array(keyValueSchema).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

const resourceLogsSchema = z.object({
  resource: z.object({ attributes: z.array(keyValueSchema).optional() }).optional(),
  scopeLogs: z.array(z.object({ logRecords: z.array(logRecordSchema).optional() })).optional(),
});

export const otlpLogsRequestSchema = z.object({
  resourceLogs: z.array(resourceLogsSchema).optional(),
});

export type OtlpAnyValue = z.infer<typeof anyValueSchema>;
export type OtlpKeyValue = z.infer<typeof keyValueSchema>;
export type OtlpLogRecord = z.infer<typeof logRecordSchema>;
export type OtlpLogsRequest = z.infer<typeof otlpLogsRequestSchema>;

export interface FlatLogRecord {
  resource: Record<string, string>;
  record: OtlpLogRecord;
}

export function anyValueToString(value: OtlpAnyValue | undefined): string | undefined {
  if (!value) return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return String(value.intValue);
  if (value.doubleValue !== undefined) return String(value.doubleValue);
  if (value.boolValue !== undefined) return String(value.boolValue);
  return undefined;
}

export function attributesToMap(attributes: OtlpKeyValue[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const attribute of attributes ?? []) {
    const value = anyValueToString(attribute.value);
    if (attribute.key && value !== undefined) map[attribute.key] = value;
  }
  return map;
}

export function nanosToIso(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  if (!/^\d{1,25}$/.test(text)) return undefined;
  const millis = Number(BigInt(text) / 1_000_000n);
  if (!Number.isFinite(millis) || millis <= 0) return undefined;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function buildTags(attributes: Record<string, string>): Record<string, string> | undefined {
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (MAPPED_ATTRIBUTE_KEYS.has(key)) continue;
    if (key.length === 0 || key.length > MAX_TAG_KEY) continue;
    if (Object.keys(tags).length >= MAX_TAGS) break;
    tags[key] = value.slice(0, MAX_TAG_VALUE);
  }
  return Object.keys(tags).length > 0 ? tags : undefined;
}

export function flattenLogRecords(payload: OtlpLogsRequest): FlatLogRecord[] {
  const flattened: FlatLogRecord[] = [];
  for (const resourceLogs of payload.resourceLogs ?? []) {
    const resource = attributesToMap(resourceLogs.resource?.attributes);
    for (const scopeLogs of resourceLogs.scopeLogs ?? []) {
      for (const record of scopeLogs.logRecords ?? []) {
        flattened.push({ resource, record });
      }
    }
  }
  return flattened;
}

/**
 * Project one OTLP log record onto the error shape the rule engine already
 * understands. Returns null when the record cannot describe an error — no
 * service name, or no message to show a human.
 */
export function logRecordToBrowserError(
  resource: Record<string, string>,
  record: OtlpLogRecord,
): BrowserError | null {
  const service = resource["service.name"]?.trim();
  if (!service) return null;

  const attributes = attributesToMap(record.attributes);
  const message = (
    anyValueToString(record.body) ??
    attributes["error.message"] ??
    attributes["exception.message"] ??
    ""
  ).trim();
  if (!message) return null;

  const type =
    attributes["error.type"] ??
    attributes["exception.type"] ??
    record.severityText ??
    "LogRecord";

  const traceId = record.traceId;
  const spanId = record.spanId;
  const candidate = {
    version: 1 as const,
    service: service.slice(0, 120),
    environment: (resource["deployment.environment"] ?? "unknown").slice(0, 64),
    release: resource["service.version"]?.slice(0, 120),
    occurredAt: nanosToIso(record.timeUnixNano ?? record.observedTimeUnixNano),
    error: {
      type: type.slice(0, 160),
      message: message.slice(0, 2_000),
      stack: attributes["exception.stacktrace"]?.slice(0, 12_000),
    },
    trace: traceId && /^[0-9a-f]{32}$/i.test(traceId)
      ? { traceId, spanId: spanId && /^[0-9a-f]{16}$/i.test(spanId) ? spanId : undefined }
      : undefined,
    tags: buildTags(attributes),
  };

  const parsed = browserErrorSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function otlpJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function otlpFailure(message: string, status: number): Response {
  return otlpJson({ code: status, message }, status);
}

/**
 * The single OTLP endpoint: a collector pushes logs here and NoxAlert answers
 * "alert" or "no alert" from the rules already configured for the project. The
 * response body stays exactly ExportLogsServiceResponse so the collector's
 * strict unmarshaller stays happy; the decision itself is logged, not returned.
 */
export async function handleOtlpLogs(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return otlpFailure("method_not_allowed", 405);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const ipLimit = await env.ERROR_IP_RATE_LIMITER.limit({ key: `otlp:${ip}` });
  if (!ipLimit.success) return otlpFailure("rate_limited", 429);

  const providedKey = request.headers.get("X-Nox-Ingest-Key")?.trim() ?? "";
  const key = await findIngestKey(env, providedKey);
  if (!key) return otlpFailure("invalid_ingest_key", 401);

  let payload: OtlpLogsRequest;
  try {
    payload = otlpLogsRequestSchema.parse(await readJsonBody(request, MAX_OTLP_BODY_BYTES));
  } catch (cause) {
    const { code, status } = errorStatus(cause);
    return otlpFailure(code, status);
  }

  const flattened = flattenLogRecords(payload);
  const batch = flattened.slice(0, MAX_OTLP_RECORDS);
  let rejected = flattened.length - batch.length;
  let accepted = 0;
  let alerted = 0;

  const now = new Date();
  for (let index = 0; index < batch.length; index += 1) {
    const entry = batch[index]!;
    const error = logRecordToBrowserError(entry.resource, entry.record);
    if (!error) {
      rejected += 1;
      continue;
    }
    const projectLimit = await env.ERROR_PROJECT_RATE_LIMITER.limit({ key: `project:${key.project_id}` });
    if (!projectLimit.success) {
      rejected += batch.length - index;
      break;
    }
    accepted += 1;
    if (await evaluateError(env, key, error, now) > 0) alerted += 1;
  }

  await touchIngestKey(env, key, now);
  console.log(JSON.stringify({
    message: "otlp logs ingested",
    projectId: key.project_id,
    received: flattened.length,
    accepted,
    rejected,
    alerted,
  }));

  if (rejected === 0) return otlpJson({}, 200);
  return otlpJson({
    partialSuccess: {
      rejectedLogRecords: rejected,
      errorMessage: "records were dropped: unmappable, or over the per-request or per-project limit",
    },
  }, 200);
}
