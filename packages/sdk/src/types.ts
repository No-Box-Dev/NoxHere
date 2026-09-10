export const NOXCUE_AUTH_FEATURES = [
  "auth.signup",
  "auth.login",
  "auth.password_reset",
  "auth.email_verification",
  "auth.oauth",
  "auth.mfa",
  "auth.session_refresh",
  "auth.logout",
] as const;

export type NoxCueAuthFeature = (typeof NOXCUE_AUTH_FEATURES)[number];
export type NoxCueFeature = NoxCueAuthFeature | `custom.${string}`;
export type NoxCueEnvironment = "production" | "staging" | "development" | "preview" | "test" | "local";
export type NoxCueOutcome = "success" | "rejected" | "failure";
export type NoxCueReason =
  | "invalid_input"
  | "invalid_credentials"
  | "account_exists"
  | "account_unverified"
  | "account_locked"
  | "verification_expired"
  | "mfa_required"
  | "rate_limited"
  | "policy_rejected"
  | "dependency_unavailable"
  | "database_unavailable"
  | "email_delivery_failed"
  | "oauth_failed"
  | "session_failed"
  | "configuration_error"
  | "timeout"
  | "network_error"
  | "internal_error"
  | "unknown";

export interface DeliveryResult {
  ok: boolean;
  eventId: string;
  status?: number;
  error?: "invalid_configuration" | "payload_too_large" | "timeout" | "network_error" | "rejected";
}

export interface NoxCueOptions {
  key: string;
  /** Optional assertion. The source key remains the authoritative environment. */
  environment?: NoxCueEnvironment;
  release?: string;
  endpoint?: string;
  timeoutMs?: number;
  /** Retries after the first attempt. Defaults to 2 and is capped at 3. */
  maxRetries?: number;
  enabled?: boolean;
  fetch?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface BrowserNoxCueOptions extends NoxCueOptions {
  /** Capture window errors and unhandled promise rejections. Defaults to true. */
  captureUnhandled?: boolean;
}

export interface EventOptions {
  occurredAt?: string;
  idempotencyKey?: string;
}

export interface ActivityOptions extends EventOptions {
  eventId?: string;
}

interface FeatureResultCommon extends EventOptions {
  durationMs?: number;
  test?: boolean;
}

export type FeatureResultOptions = FeatureResultCommon & (
  | { outcome: "failure"; reason?: NoxCueReason; message?: string; error: unknown }
  | { outcome: "success" | "rejected"; reason?: NoxCueReason; message?: string; error?: never }
);

export interface ObserveOptions {
  classify?: (error: unknown) => { outcome: NoxCueOutcome; reason?: NoxCueReason };
}

export interface BrowserErrorOptions extends EventOptions {
  title?: string;
  message?: string;
  url?: string;
  component?: string;
  affectedUser?: string;
  fatal?: boolean;
  unhandled?: boolean;
  attributes?: Record<string, string | number | boolean>;
}

export interface ServerErrorOptions extends BrowserErrorOptions {
  fingerprint?: string;
}

export type ObservedOperation = <T>(operation: () => T | Promise<T>, options?: ObserveOptions) => Promise<T>;

interface BaseNoxCueClient<ErrorOptions extends BrowserErrorOptions> {
  feature: {
    result(feature: NoxCueFeature, result: FeatureResultOptions): Promise<DeliveryResult>;
    observe<T>(feature: NoxCueFeature, operation: () => T | Promise<T>, options?: ObserveOptions): Promise<T>;
  };
  auth: {
    signup: ObservedOperation;
    login: ObservedOperation;
    passwordReset: ObservedOperation;
    emailVerification: ObservedOperation;
    oauth: ObservedOperation;
    mfa: ObservedOperation;
    sessionRefresh: ObservedOperation;
    logout: ObservedOperation;
  };
  /** Fire-and-forget error capture. Delivery is tracked by flush(). */
  capture(error: unknown, options?: ErrorOptions): void;
  error(error: unknown, options?: ErrorOptions): Promise<DeliveryResult>;
  test(feature?: NoxCueAuthFeature): Promise<DeliveryResult>;
  flush(): Promise<DeliveryResult[]>;
  close(): void;
}

export type BrowserNoxCueClient = BaseNoxCueClient<BrowserErrorOptions>;

export interface ServerNoxCueClient extends BaseNoxCueClient<ServerErrorOptions> {
  user: {
    registered(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    active(userId: string, options?: EventOptions): Promise<DeliveryResult>;
  };
  activity(metric: `custom.${string}`, userId: string, options?: ActivityOptions): Promise<DeliveryResult>;
}

export interface NoxCueAdapterOptions {
  component?: string;
}
