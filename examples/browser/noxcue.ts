export const NOXCUE_AUTH_FEATURES = [
  "auth.signup", "auth.login", "auth.password_reset", "auth.email_verification",
  "auth.oauth", "auth.mfa", "auth.session_refresh", "auth.logout",
] as const;

export type NoxCueAuthFeature = (typeof NOXCUE_AUTH_FEATURES)[number];
export type NoxCueOutcome = "success" | "rejected" | "failure";
export type NoxCueReason =
  | "invalid_input" | "invalid_credentials" | "account_exists" | "account_unverified"
  | "account_locked" | "verification_expired" | "mfa_required" | "rate_limited"
  | "policy_rejected" | "dependency_unavailable" | "database_unavailable"
  | "email_delivery_failed" | "oauth_failed" | "session_failed"
  | "configuration_error" | "timeout" | "network_error" | "internal_error" | "unknown";

export interface NoxCueOptions { endpoint?: string; ingestKey: string; }
export interface ErrorCueInput {
  title: string; message?: string; occurredAt?: string; url?: string; idempotencyKey?: string;
  data?: { errorCode?: string; fingerprint?: string; component?: string; environment?: string;
    affectedUser?: string; fatal?: boolean; unhandled?: boolean; };
}

interface ProviderResult { error?: unknown; }
interface ProviderError { status?: unknown; statusCode?: unknown; name?: unknown; }
type AuthOperation = <T>(operation: () => T | Promise<T>) => Promise<T>;

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
      body: JSON.stringify({ version: 1, ...body }),
    });
    if (!response.ok) throw new Error(`NoxCue rejected the event (${response.status})`);
    return ((await response.json()) as { eventId: string }).eventId;
  }
  function report(body: Record<string, unknown>) {
    // Reporting is fail-open: it never delays or changes the application's auth result.
    void post(body).catch(() => undefined);
  }
  async function observe<T>(feature: NoxCueAuthFeature, operation: () => T | Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const result = await operation();
      const providerError = result && typeof result === "object" && "error" in result
        ? (result as ProviderResult).error : null;
      const measured = providerError ? classify(feature, providerError) : result instanceof Response && !result.ok
        ? classify(feature, result) : { outcome: "success" as const };
      report({ type: "feature.result", feature, ...measured, durationMs: Math.round(performance.now() - started) });
      return result;
    } catch (error) {
      report({ type: "feature.result", feature, ...classify(feature, error), durationMs: Math.round(performance.now() - started) });
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
    test: (feature: NoxCueAuthFeature = "auth.signup") =>
      post({ type: "feature.result", feature, outcome: "success", test: true }),
    userRegistered: (userId: string, occurredAt?: string) =>
      post({ type: "user.registered", userId, ...(occurredAt ? { occurredAt } : {}) }),
    userActive: (userId: string, occurredAt?: string) =>
      post({ type: "user.active", userId, ...(occurredAt ? { occurredAt } : {}) }),
    error: (input: ErrorCueInput) => post({ type: "error.occurred", ...input }),
  };
}
