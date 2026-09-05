export const NOXCUE_AUTH_FEATURES = [
  "auth.signup", "auth.login", "auth.password_reset", "auth.email_verification",
  "auth.oauth", "auth.mfa", "auth.session_refresh", "auth.logout",
] as const;

export type NoxCueAuthFeature = (typeof NOXCUE_AUTH_FEATURES)[number];
export type NoxCueFeature = NoxCueAuthFeature | `custom.${string}`;
export type NoxCueOutcome = "success" | "rejected" | "failure";
export type NoxCueReason =
  | "invalid_input" | "invalid_credentials" | "account_exists" | "account_unverified"
  | "account_locked" | "verification_expired" | "mfa_required" | "rate_limited"
  | "policy_rejected" | "dependency_unavailable" | "database_unavailable"
  | "email_delivery_failed" | "oauth_failed" | "session_failed"
  | "configuration_error" | "timeout" | "network_error" | "internal_error" | "unknown";

export type NoxCueEnvironment = "production" | "staging" | "development" | "preview" | "test" | "local";
export interface NoxCueOptions {
  endpoint?: string;
  ingestKey: string;
  environment: NoxCueEnvironment;
  release?: string;
}
export interface ErrorCueInput {
  title: string; error?: unknown; message?: string; occurredAt?: string; url?: string; idempotencyKey?: string;
  data?: { errorCode?: string; fingerprint?: string; component?: string; environment?: string;
    affectedUser?: string; fatal?: boolean; unhandled?: boolean; };
}

interface ProviderResult { error?: unknown; }
interface ProviderError {
  status?: unknown; statusCode?: unknown; name?: unknown; message?: unknown; code?: unknown; stack?: unknown;
}
type AuthOperation = <T>(operation: () => T | Promise<T>) => Promise<T>;

const MAX_MESSAGE = 2_000;
const MAX_STACK = 8_000;

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
  } catch { return undefined; }
}

export function safeErrorDetails(value: unknown) {
  if (value instanceof Response) {
    return { name: "ResponseError", message: `HTTP ${value.status} ${value.statusText || "request failed"}`.trim(), code: `HTTP_${value.status}`, status: value.status };
  }
  const record = value && typeof value === "object" ? value as ProviderError : {};
  const message = redact(bounded(record.message, MAX_MESSAGE) ?? bounded(value, MAX_MESSAGE) ?? "Unknown error");
  const name = redact(bounded(record.name, 120) ?? (value instanceof Error ? value.name : "Error"));
  const code = redact(bounded(record.code, 120) ?? (statusOf(value) ? `HTTP_${statusOf(value)}` : "UNKNOWN"));
  const stack = bounded(record.stack, MAX_STACK);
  const status = statusOf(value);
  return { name, message, code, ...(status !== null && status >= 100 && status <= 599 ? { status } : {}), ...(stack ? { stack: redact(stack) } : {}) };
}

function detectedRuntime(): "browser" | "server" | "edge" | "unknown" {
  if (typeof window !== "undefined" && typeof document !== "undefined") return "browser";
  if (typeof navigator !== "undefined" && /Cloudflare-Workers/i.test(navigator.userAgent)) return "edge";
  return typeof globalThis !== "undefined" ? "server" : "unknown";
}

function metaValue(name: string): string | undefined {
  return typeof document === "undefined" ? undefined
    : bounded(document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content, 120);
}

function automaticContext(options: NoxCueOptions) {
  const hostname = typeof location === "undefined" ? "" : location.hostname;
  const inferredEnvironment = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")
    ? "development" : "production";
  return {
    environment: bounded(options.environment, 80) ?? metaValue("noxcue-environment") ?? inferredEnvironment,
    release: bounded(options.release, 120) ?? metaValue("noxcue-release"),
    runtime: detectedRuntime(),
    url: typeof location === "undefined" ? undefined : safeUrl(location.href),
  };
}

function statusOf(value: unknown): number | null {
  if (value instanceof Response) return value.status;
  if (!value || typeof value !== "object") return null;
  const error = value as ProviderError;
  const status = typeof error.status === "number" ? error.status : error.statusCode;
  return typeof status === "number" ? status : null;
}

function classify(feature: NoxCueAuthFeature, value: unknown): { outcome: NoxCueOutcome; reason?: NoxCueReason } {
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

export function createNoxCue(options: NoxCueOptions) {
  const endpoint = (options.endpoint ?? "https://noxcue.jasper-414.workers.dev").replace(/\/$/, "");
  async function post(body: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${endpoint}/v1/events`, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": options.ingestKey },
      body: JSON.stringify({ version: 1, environment: options.environment, ...body }),
    });
    if (!response.ok) throw new Error(`NoxCue rejected the event (${response.status})`);
    return ((await response.json()) as { eventId: string }).eventId;
  }
  function report(body: Record<string, unknown>) {
    // Reporting is fail-open: it never delays or changes the application's auth result.
    void post(body).catch(() => undefined);
  }
  function featureReport(feature: NoxCueFeature, measured: { outcome: NoxCueOutcome; reason?: NoxCueReason }, started: number, evidence?: unknown) {
    const error = measured.outcome === "failure" ? safeErrorDetails(evidence) : undefined;
    report({
      type: "feature.result", feature, ...measured,
      occurredAt: new Date().toISOString(), context: automaticContext(options),
      durationMs: Math.round(performance.now() - started),
      ...(error ? { message: error.message, error } : {}),
    });
  }
  async function observe<T>(feature: NoxCueFeature, operation: () => T | Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const result = await operation();
      const providerError = result && typeof result === "object" && "error" in result
        ? (result as ProviderResult).error : null;
      const failedValue = providerError || result instanceof Response && !result.ok ? providerError ?? result : null;
      const measured = failedValue
        ? classify(feature as NoxCueAuthFeature, failedValue)
        : { outcome: "success" as const };
      featureReport(feature, measured, started, failedValue);
      return result;
    } catch (error) {
      const measured = classify(feature as NoxCueAuthFeature, error);
      featureReport(feature, measured, started, error);
      throw error;
    }
  }
  const wrap = (feature: NoxCueAuthFeature): AuthOperation => operation => observe(feature, operation);
  return {
    auth: {
      signup: wrap("auth.signup"), login: wrap("auth.login"), passwordReset: wrap("auth.password_reset"),
      emailVerification: wrap("auth.email_verification"), oauth: wrap("auth.oauth"), mfa: wrap("auth.mfa"),
      sessionRefresh: wrap("auth.session_refresh"), logout: wrap("auth.logout"),
    },
    observe,
    test: (feature: NoxCueAuthFeature = "auth.signup") =>
      post({ type: "feature.result", feature, outcome: "success", test: true, occurredAt: new Date().toISOString(), context: automaticContext(options) }),
    userRegistered: (userId: string, occurredAt?: string) =>
      post({ type: "user.registered", userId, occurredAt: occurredAt ?? new Date().toISOString() }),
    userActive: (userId: string, occurredAt?: string) =>
      post({ type: "user.active", userId, occurredAt: occurredAt ?? new Date().toISOString() }),
    error: (input: ErrorCueInput) => {
      const details = input.error === undefined ? undefined : safeErrorDetails(input.error);
      const context = automaticContext(options);
      const { error: _error, ...event } = input;
      return post({
        type: "error.occurred", ...event,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        url: input.url ?? context.url,
        message: input.message ?? details?.message,
        error: details,
        context,
        data: {
          ...input.data,
          errorCode: input.data?.errorCode ?? details?.code,
          environment: input.data?.environment ?? context.environment,
        },
      });
    },
  };
}
