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
import {
  DEFAULT_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  MAX_BODY_BYTES,
  MAX_RESPONSE_BYTES,
  MAX_RETRY_AFTER_MS,
  MAX_TIMEOUT_MS,
  RETRY_DELAY_MS,
  SDK_VERSION,
} from "./contract.js";

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

interface RuntimeProcess {
  env?: Record<string, string | undefined>;
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function inferredRelease(explicit: string | undefined): string | undefined {
  const configured = bounded(explicit, 120);
  if (configured) return configured;
  const process = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  const env = process?.env;
  return bounded(env?.NOXCUE_RELEASE ?? env?.VERCEL_GIT_COMMIT_SHA ?? env?.CF_PAGES_COMMIT_SHA
    ?? env?.GITHUB_SHA ?? env?.RENDER_GIT_COMMIT ?? env?.HEROKU_SLUG_COMMIT, 120);
}

function incidentPart(value: string | undefined, fallback: string): string {
  return (value ?? fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}

function inferredComponent(explicit: string | undefined, url: string | undefined, runtime: Runtime): string {
  const configured = bounded(explicit, 120);
  if (configured) return configured;
  if (url) {
    try {
      const segment = new URL(url).pathname.split("/").filter(Boolean)[0];
      if (segment) return `route.${incidentPart(segment, "root")}`;
    } catch { /* safeUrl already validates ordinary input. */ }
  }
  return `${runtime}.application`;
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
  const maxRetries = Math.min(3, Math.max(0, Math.round(options.maxRetries ?? 2)));
  const request = options.fetch ?? fetch;
  const configured = options.enabled !== false && validKey(options.key, keyKind) && validEndpoint(endpoint);
  const pending = new Set<Promise<DeliveryResult>>();
  let closed = false;
  let identifiedUserId: string | undefined;

  const currentUserId = () => {
    try {
      return bounded(options.getUser?.()?.id, 200) ?? identifiedUserId;
    } catch {
      return identifiedUserId;
    }
  };

  const context = () => {
    const release = inferredRelease(options.release);
    const url = safeUrl(runtime.currentUrl?.());
    return {
      ...(options.environment ? { environment: options.environment } : {}),
      ...(release ? { release } : {}),
      runtime: runtime.kind,
      ...(url ? { url } : {}),
      sdkVersion: SDK_VERSION,
    };
  };

  async function post(rawEvent: Record<string, unknown>): Promise<DeliveryResult> {
    const eventId = typeof rawEvent.eventId === "string" ? rawEvent.eventId : randomUuid();
    if (!configured || closed) return { ok: false, eventId, error: "invalid_configuration" };
    let body: string;
    try {
      body = JSON.stringify({ version: 1, ...(options.environment ? { environment: options.environment } : {}), eventId, ...rawEvent });
    } catch {
      return { ok: false, eventId, error: "payload_too_large" };
    }
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return { ok: false, eventId, error: "payload_too_large" };
    }

    const totalAttempts = maxRetries + 1;
    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": options.key },
          body,
          signal: controller.signal,
        });
        if (response.ok) {
          return { ok: true, eventId: await readEventId(response, eventId), status: response.status };
        }
        const delay = retryable(response.status) ? retryDelay(response) : null;
        await response.body?.cancel();
        if (attempt === totalAttempts || delay === null) return { ok: false, eventId, status: response.status, error: "rejected" };
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(MAX_RETRY_AFTER_MS, delay * (2 ** (attempt - 1)))));
      } catch (error) {
        if (attempt === totalAttempts) {
          return {
            ok: false,
            eventId,
            error: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
          };
        }
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(MAX_RETRY_AFTER_MS, RETRY_DELAY_MS * (2 ** (attempt - 1)))));
      } finally {
        clearTimeout(timeout);
      }
    }
    return { ok: false, eventId, error: "network_error" };
  }

  function deliver(event: Record<string, unknown>): Promise<DeliveryResult> {
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
    return delivery;
  }

  function capture(event: Record<string, unknown>): void {
    void deliver(event);
  }

  function featureEvent(feature: NoxCueFeature, result: FeatureResultOptions): Record<string, unknown> {
    const error = result.outcome === "failure" ? safeErrorDetails(result.error) : undefined;
    const userId = currentUserId();
    return {
      type: "feature.result",
      feature,
      outcome: result.outcome,
      ...(userId ? { userId } : {}),
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
      result: (feature: NoxCueFeature, result: FeatureResultOptions) => deliver(featureEvent(feature, result)),
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
    identify: (user: { id: string } | null) => { identifiedUserId = bounded(user?.id, 200); },
    test: (feature: NoxCueAuthFeature = "auth.signup") => deliver(featureEvent(feature, {
      outcome: "success",
      test: true,
      occurredAt: new Date().toISOString(),
    })),
    flush: async () => {
      const results: DeliveryResult[] = [];
      while (pending.size) results.push(...await Promise.all([...pending]));
      return results;
    },
    close: () => { closed = true; },
  };

  function reportError(error: unknown, errorOptions: ErrorOptions = {}): Promise<DeliveryResult> {
    const details = safeErrorDetails(error);
    const attributes = primitiveAttributes(errorOptions.attributes);
    const explicitFingerprint = "fingerprint" in errorOptions ? bounded(errorOptions.fingerprint, 200) : undefined;
    const affectedUser = bounded(errorOptions.affectedUser, 200) ?? currentUserId();
    const explicitUrl = safeUrl(errorOptions.url);
    const currentUrl = safeUrl(runtime.currentUrl?.());
    const url = explicitUrl ?? currentUrl;
    const component = inferredComponent(errorOptions.component, url, runtime.kind);
    const fingerprint = explicitFingerprint ?? [
      "error.occurred",
      incidentPart(component, `${runtime.kind}.application`),
      incidentPart(details.code, "unknown"),
      incidentPart(details.name, "error"),
    ].join("|");
    return deliver({
      type: "error.occurred",
      title: bounded(errorOptions.title, 200) ?? details.message.slice(0, 200),
      message: redact(bounded(errorOptions.message, 2_000) ?? details.message),
      error: details,
      context: context(),
      occurredAt: errorOptions.occurredAt ?? new Date().toISOString(),
      ...(errorOptions.idempotencyKey ? { idempotencyKey: errorOptions.idempotencyKey.slice(0, 200) } : {}),
      ...(url ? { url } : {}),
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
      capture: (error: unknown, errorOptions: BrowserErrorOptions = {}) => { void reportError(error, errorOptions); },
    };
  }

  return {
    ...shared,
    error: (error: unknown, errorOptions: ServerErrorOptions = {}) => reportError(error, errorOptions),
    capture: (error: unknown, errorOptions: ServerErrorOptions = {}) => { void reportError(error, errorOptions); },
    forUser: (userId: string) => createClient({ ...options, getUser: () => ({ id: userId }) }, "secret", runtime),
    user: {
      registered: (userId: string, event: EventOptions = {}) => deliver({
        type: "user.registered",
        userId: userId.slice(0, 200),
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey.slice(0, 200) } : {}),
        context: context(),
      }),
      active: (userId: string, event: EventOptions = {}) => deliver({
        type: "user.active",
        userId: userId.slice(0, 200),
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey.slice(0, 200) } : {}),
        context: context(),
      }),
    },
    activity: (metric: `custom.${string}`, userId: string, event: ActivityOptions = {}) => deliver({
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
