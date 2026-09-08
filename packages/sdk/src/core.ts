import type {
  ActivityOptions,
  BrowserErrorOptions,
  BrowserNoxCueClient,
  DeliveryResult,
  EventOptions,
  FeatureResultOptions,
  NoxCueAuthFeature,
  NoxCueFeature,
  NoxCueOptions,
  NoxCueOutcome,
  NoxCueReason,
  ObserveOptions,
  ServerErrorOptions,
  ServerNoxCueClient,
} from "./types.js";

const SDK_VERSION = "0.1.1";
const DEFAULT_ENDPOINT = "https://app.unticket.ai/api/cues/public/v1/events";
const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 32_768;
const MAX_RESPONSE_BYTES = 4_096;
const RETRY_DELAY_MS = 250;
const MAX_RETRY_AFTER_MS = 1_000;

type Runtime = "browser" | "server" | "edge" | "unknown";
type KeyKind = "publishable" | "secret";
type ErrorOptions = BrowserErrorOptions | ServerErrorOptions;

interface ProviderResult {
  error?: unknown;
}

interface ProviderError {
  status?: unknown;
  statusCode?: unknown;
  name?: unknown;
  message?: unknown;
  code?: unknown;
  stack?: unknown;
}

interface ClientRuntime {
  kind: Runtime;
  currentUrl?: () => string | undefined;
}

function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function redact(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/([?&](?:token|key|secret|password|code)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? `${url.origin}${url.pathname}` : undefined;
  } catch {
    return undefined;
  }
}

function statusOf(value: unknown): number | null {
  if (typeof Response !== "undefined" && value instanceof Response) return value.status;
  if (!value || typeof value !== "object") return null;
  const error = value as ProviderError;
  const status = typeof error.status === "number" ? error.status : error.statusCode;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}

export function safeErrorDetails(value: unknown) {
  if (typeof Response !== "undefined" && value instanceof Response) {
    return {
      name: "ResponseError",
      message: `HTTP ${value.status} ${value.statusText || "request failed"}`.trim(),
      code: `HTTP_${value.status}`,
      status: value.status,
    };
  }
  const record = value && typeof value === "object" ? value as ProviderError : {};
  const status = statusOf(value);
  const message = redact(bounded(record.message, 2_000) ?? bounded(value, 2_000) ?? "Unknown error");
  const name = redact(bounded(record.name, 120) ?? (value instanceof Error ? value.name : "Error"));
  const code = redact(bounded(record.code, 120) ?? (status === null ? "UNKNOWN" : `HTTP_${status}`));
  const stack = bounded(record.stack, 8_000);
  return {
    name,
    message,
    code,
    ...(status !== null && status >= 100 && status <= 599 ? { status } : {}),
    ...(stack ? { stack: redact(stack) } : {}),
  };
}

function randomUuid(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("NoxCue requires crypto.randomUUID()");
  }
  return crypto.randomUUID();
}

function validEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  } catch {
    return false;
  }
}

function validKey(key: string, kind: KeyKind): boolean {
  const prefix = kind === "publishable" ? "nox_pub_" : "nox_secret_";
  return key.startsWith(prefix) && key.length >= prefix.length + 30;
}

function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return RETRY_DELAY_MS;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? Math.max(0, Math.ceil(seconds * 1_000))
    : Math.max(0, Date.parse(retryAfter) - Date.now());
  return Number.isFinite(delay) && delay <= MAX_RETRY_AFTER_MS ? delay : null;
}

async function readEventId(response: Response, fallback: string): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_RESPONSE_BYTES || !response.body) return fallback;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return fallback;
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    const parsed = JSON.parse(text + decoder.decode()) as { eventId?: unknown };
    return typeof parsed.eventId === "string" ? parsed.eventId : fallback;
  } catch {
    return fallback;
  }
}

function classify(feature: NoxCueFeature, value: unknown): { outcome: NoxCueOutcome; reason?: NoxCueReason } {
  const status = statusOf(value);
  if (status === 429) return { outcome: "rejected", reason: "rate_limited" };
  if (status !== null && status >= 500) return { outcome: "failure", reason: "dependency_unavailable" };
  if (status !== null && status >= 400) {
    if (feature === "auth.login") return { outcome: "rejected", reason: "invalid_credentials" };
    if (feature === "auth.oauth") return { outcome: "rejected", reason: "oauth_failed" };
    return { outcome: "rejected", reason: "invalid_input" };
  }
  if (value && typeof value === "object" && "name" in value && (value as ProviderError).name === "AbortError") {
    return { outcome: "failure", reason: "timeout" };
  }
  if (value instanceof TypeError) return { outcome: "failure", reason: "network_error" };
  return { outcome: "failure", reason: "unknown" };
}

function observedResult(
  measured: { outcome: NoxCueOutcome; reason?: NoxCueReason },
  durationMs: number,
  evidence: unknown,
): FeatureResultOptions {
  const reason = measured.reason ? { reason: measured.reason } : {};
  return measured.outcome === "failure"
    ? { outcome: "failure", ...reason, durationMs, error: evidence }
    : { outcome: measured.outcome, ...reason, durationMs };
}

function primitiveAttributes(value: Record<string, string | number | boolean> | undefined) {
  if (!value) return undefined;
  const entries = Object.entries(value).slice(0, 96).flatMap(([rawKey, rawValue]) => {
    const key = rawKey.trim().slice(0, 120);
    if (!/^[a-z][a-z0-9_.\[\]-]{0,119}$/i.test(key)) return [];
    const nextValue = typeof rawValue === "string" ? redact(rawValue.trim().slice(0, 300)) : rawValue;
    return [[key, nextValue] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function createClient(options: NoxCueOptions, keyKind: "publishable", runtime: ClientRuntime): BrowserNoxCueClient;
export function createClient(options: NoxCueOptions, keyKind: "secret", runtime: ClientRuntime): ServerNoxCueClient;
export function createClient(
  options: NoxCueOptions,
  keyKind: KeyKind,
  runtime: ClientRuntime,
): BrowserNoxCueClient | ServerNoxCueClient {
  const endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).trim();
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(250, options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const request = options.fetch ?? fetch;
  const configured = validKey(options.key, keyKind) && validEndpoint(endpoint);
  const pending = new Set<Promise<DeliveryResult>>();

  const context = () => {
    const release = bounded(options.release, 120);
    const url = safeUrl(runtime.currentUrl?.());
    return {
      environment: options.environment,
      ...(release ? { release } : {}),
      runtime: runtime.kind,
      ...(url ? { url } : {}),
      sdkVersion: SDK_VERSION,
    };
  };

  async function post(rawEvent: Record<string, unknown>): Promise<DeliveryResult> {
    const eventId = typeof rawEvent.eventId === "string" ? rawEvent.eventId : randomUuid();
    if (!configured) return { ok: false, eventId, error: "invalid_configuration" };
    const body = JSON.stringify({ version: 1, environment: options.environment, eventId, ...rawEvent });
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return { ok: false, eventId, error: "payload_too_large" };
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(endpoint, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": options.key },
          body,
          signal: controller.signal,
        });
        if (response.ok) {
          return { ok: true, eventId: await readEventId(response, eventId), status: response.status };
        }
        const delay = retryable(response.status) ? retryDelay(response) : null;
        await response.body?.cancel();
        if (attempt === 2 || delay === null) return { ok: false, eventId, status: response.status, error: "rejected" };
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        if (attempt === 2) {
          return {
            ok: false,
            eventId,
            error: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
          };
        }
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } finally {
        clearTimeout(timeout);
      }
    }
    return { ok: false, eventId, error: "network_error" };
  }

  function capture(event: Record<string, unknown>): void {
    const delivery = post(event);
    pending.add(delivery);
    void delivery.then(
      () => pending.delete(delivery),
      () => pending.delete(delivery),
    );
    try {
      options.waitUntil?.(delivery);
    } catch {
      // Host scheduling must never change the observed application operation.
    }
  }

  function featureEvent(feature: NoxCueFeature, result: FeatureResultOptions): Record<string, unknown> {
    const error = result.outcome === "failure" ? safeErrorDetails(result.error) : undefined;
    return {
      type: "feature.result",
      feature,
      outcome: result.outcome,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.message ? { message: redact(result.message.slice(0, 2_000)) } : error ? { message: error.message } : {}),
      ...(error ? { error } : {}),
      ...(result.durationMs === undefined ? {} : { durationMs: Math.max(0, Math.min(120_000, Math.round(result.durationMs))) }),
      ...(result.test ? { test: true } : {}),
      occurredAt: result.occurredAt ?? new Date().toISOString(),
      ...(result.idempotencyKey ? { idempotencyKey: result.idempotencyKey.slice(0, 200) } : {}),
      context: context(),
    };
  }

  async function observe<T>(
    feature: NoxCueFeature,
    operation: () => T | Promise<T>,
    observeOptions?: ObserveOptions,
  ): Promise<T> {
    const started = performance.now();
    try {
      const result = await operation();
      const providerError = result && typeof result === "object" && "error" in result
        ? (result as ProviderResult).error
        : null;
      const failedValue = providerError || (typeof Response !== "undefined" && result instanceof Response && !result.ok)
        ? providerError ?? result
        : null;
      const measured = failedValue
        ? observeOptions?.classify?.(failedValue) ?? classify(feature, failedValue)
        : { outcome: "success" as const };
      capture(featureEvent(feature, observedResult(measured, performance.now() - started, failedValue)));
      return result;
    } catch (error) {
      const measured = observeOptions?.classify?.(error) ?? classify(feature, error);
      capture(featureEvent(feature, observedResult(measured, performance.now() - started, error)));
      throw error;
    }
  }

  const wrap = (feature: NoxCueAuthFeature) => <T>(operation: () => T | Promise<T>, observeOptions?: ObserveOptions) =>
    observe(feature, operation, observeOptions);

  const shared = {
    feature: {
      result: (feature: NoxCueFeature, result: FeatureResultOptions) => post(featureEvent(feature, result)),
      observe,
    },
    auth: {
      signup: wrap("auth.signup"),
      login: wrap("auth.login"),
      passwordReset: wrap("auth.password_reset"),
      emailVerification: wrap("auth.email_verification"),
      oauth: wrap("auth.oauth"),
      mfa: wrap("auth.mfa"),
      sessionRefresh: wrap("auth.session_refresh"),
      logout: wrap("auth.logout"),
    },
    test: (feature: NoxCueAuthFeature = "auth.signup") => post(featureEvent(feature, {
      outcome: "success",
      test: true,
      occurredAt: new Date().toISOString(),
    })),
    flush: () => Promise.all([...pending]),
  };

  function reportError(error: unknown, errorOptions: ErrorOptions = {}): Promise<DeliveryResult> {
    const details = safeErrorDetails(error);
    const attributes = primitiveAttributes(errorOptions.attributes);
    const fingerprint = "fingerprint" in errorOptions ? bounded(errorOptions.fingerprint, 200) : undefined;
    const component = bounded(errorOptions.component, 120);
    const affectedUser = bounded(errorOptions.affectedUser, 200);
    const explicitUrl = safeUrl(errorOptions.url);
    const currentUrl = safeUrl(runtime.currentUrl?.());
    return post({
      type: "error.occurred",
      title: bounded(errorOptions.title, 200) ?? details.message.slice(0, 200),
      message: redact(bounded(errorOptions.message, 2_000) ?? details.message),
      error: details,
      context: context(),
      occurredAt: errorOptions.occurredAt ?? new Date().toISOString(),
      ...(errorOptions.idempotencyKey ? { idempotencyKey: errorOptions.idempotencyKey.slice(0, 200) } : {}),
      ...(explicitUrl ? { url: explicitUrl } : currentUrl ? { url: currentUrl } : {}),
      data: {
        errorCode: details.code,
        ...(component ? { component } : {}),
        ...(affectedUser ? { affectedUser } : {}),
        ...(fingerprint && keyKind === "secret" ? { fingerprint } : {}),
        fatal: errorOptions.fatal ?? false,
        unhandled: errorOptions.unhandled ?? false,
        ...(attributes ? { attributes } : {}),
      },
    });
  }

  if (keyKind === "publishable") {
    return {
      ...shared,
      error: (error: unknown, errorOptions: BrowserErrorOptions = {}) => reportError(error, errorOptions),
    };
  }

  return {
    ...shared,
    error: (error: unknown, errorOptions: ServerErrorOptions = {}) => reportError(error, errorOptions),
    user: {
      registered: (userId: string, event: EventOptions = {}) => post({
        type: "user.registered",
        userId: userId.slice(0, 200),
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey.slice(0, 200) } : {}),
        context: context(),
      }),
      active: (userId: string, event: EventOptions = {}) => post({
        type: "user.active",
        userId: userId.slice(0, 200),
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey.slice(0, 200) } : {}),
        context: context(),
      }),
    },
    activity: (metric: `custom.${string}`, userId: string, event: ActivityOptions = {}) => post({
      type: "activity.occurred",
      metric,
      userId: userId.slice(0, 200),
      eventId: event.eventId ?? randomUuid(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey.slice(0, 200) } : {}),
      context: context(),
    }),
  };
}
