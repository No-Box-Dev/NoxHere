import {
  DELIVERY_ERRORS,
  TELEMETRY_AUTH_FEATURES,
  TELEMETRY_ENVIRONMENTS,
  TELEMETRY_OUTCOMES,
  TELEMETRY_REASONS,
} from "./contract.js";

export { TELEMETRY_AUTH_FEATURES };

export type TelemetryAuthFeature = (typeof TELEMETRY_AUTH_FEATURES)[number];
export type TelemetryFeature = TelemetryAuthFeature | `custom.${string}`;
export type TelemetryEnvironment = (typeof TELEMETRY_ENVIRONMENTS)[number];
export type TelemetryOutcome = (typeof TELEMETRY_OUTCOMES)[number];
export type TelemetryReason = (typeof TELEMETRY_REASONS)[number];

export interface DeliveryResult {
  ok: boolean;
  eventId: string;
  status?: number;
  error?: (typeof DELIVERY_ERRORS)[number];
}

export interface TelemetryOptions {
  /** A source ingest key (`nox_secret_`/`nox_pub_`) or, on servers, a scoped NoxHere API token (`nox_sk_`). */
  key: string;
  /** Selects a telemetry source when a project-scoped API token can reach more than one source. */
  sourceId?: string;
  /** HMAC key used by trusted runtimes to protect user identities before transmission. */
  identityHashKey?: string;
  /** Public identifier for the current identity key. Defaults to `primary`. */
  identityKeyId?: string;
  /** Optional assertion. The source key remains authoritative. */
  environment?: TelemetryEnvironment;
  release?: string;
  endpoint?: string;
  timeoutMs?: number;
  /** Retries after the first attempt. Defaults to 2 and is capped at 3. */
  maxRetries?: number;
  enabled?: boolean;
  /** In-memory delivery for tests; performs validation and identity protection without network I/O. */
  mode?: "deliver" | "memory";
  /** Supplies the current opaque application identity without retaining profile data. */
  getUser?: () => TelemetryIdentity | null | undefined;
  fetch?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface BrowserTelemetryOptions extends TelemetryOptions {
  /** Explicit opt-in for global error and unhandled-rejection listeners. */
  captureUnhandled?: boolean;
}

export interface TelemetryIdentity {
  id: string;
  /** Accepted for sharing one identity object with the widget; never transmitted by telemetry. */
  name?: string;
  /** Accepted for sharing one identity object with the widget; never transmitted by telemetry. */
  email?: string;
  /** Accepted for sharing one identity object with the widget; never transmitted by telemetry. */
  avatarUrl?: string;
}

export interface EventOptions {
  occurredAt?: string;
  idempotencyKey?: string;
}

export interface ActivityOptions extends EventOptions {
  eventId?: string;
}

export const TELEMETRY_WEBSITE_EVENTS = [
  "website.page_visited",
  "website.demo_clicked",
  "website.signup_clicked",
  "website.pricing_clicked",
  "website.login_clicked",
  "website.contact_clicked",
] as const;

export type TelemetryWebsiteEvent = (typeof TELEMETRY_WEBSITE_EVENTS)[number];
export type TelemetryTrackName =
  | "user.registered"
  | "user.active"
  | "subscription.trial_started"
  | "subscription.paid_started"
  | "subscription.cancelled"
  | "records.parsed"
  | "reports.generated"
  | TelemetryWebsiteEvent
  | `custom.${string}`;

export interface TrackOptions extends EventOptions {
  eventId?: string;
  userId?: string;
  value?: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface AnonymousTrackOptions extends EventOptions {
  eventId?: string;
  value?: number;
  attributes?: Record<string, string | number | boolean>;
}

interface FeatureResultCommon extends EventOptions {
  durationMs?: number;
  test?: boolean;
}

export type FeatureResultOptions = FeatureResultCommon & (
  | { outcome: "failure"; reason?: TelemetryReason; message?: string; error: unknown }
  | { outcome: "success" | "rejected"; reason?: TelemetryReason; message?: string; error?: never }
);

export interface ObserveOptions {
  classify?: (error: unknown) => { outcome: TelemetryOutcome; reason?: TelemetryReason };
}

export interface BrowserErrorOptions extends EventOptions {
  title?: string;
  message?: string;
  url?: string;
  component?: string;
  fatal?: boolean;
  unhandled?: boolean;
  attributes?: Record<string, string | number | boolean>;
}

export interface ServerErrorOptions extends BrowserErrorOptions {
  fingerprint?: string;
  affectedUser?: string;
}

export type ObservedOperation = <T>(operation: () => T | Promise<T>, options?: ObserveOptions) => Promise<T>;

interface BaseTelemetryClient<ErrorOptions extends BrowserErrorOptions> {
  feature: {
    result(feature: TelemetryFeature, result: FeatureResultOptions): Promise<DeliveryResult>;
    observe<T>(feature: TelemetryFeature, operation: () => T | Promise<T>, options?: ObserveOptions): Promise<T>;
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
  /** Sets only an opaque user id; profile fields are deliberately discarded. */
  identify(user: TelemetryIdentity | null): void;
  /** Fire-and-forget error capture. Delivery is tracked by flush(). */
  capture(error: unknown, options?: ErrorOptions): void;
  error(error: unknown, options?: ErrorOptions): Promise<DeliveryResult>;
  test(feature?: TelemetryAuthFeature): Promise<DeliveryResult>;
  flush(): Promise<DeliveryResult[]>;
  close(): void;
}

export interface BrowserTelemetryClient extends BaseTelemetryClient<BrowserErrorOptions> {
  /** Records an anonymous, count-only website event. */
  track(name: TelemetryWebsiteEvent, options?: AnonymousTrackOptions): Promise<DeliveryResult>;
}

export interface ServerTelemetryClient extends BaseTelemetryClient<ServerErrorOptions> {
  /** Records an event; supplied user identities are HMAC-protected before serialization. */
  track(name: TelemetryTrackName, options?: TrackOptions): Promise<DeliveryResult>;
  /** Creates a concurrency-safe view whose feature/error events carry this opaque id. */
  forUser(userId: string): ServerTelemetryClient;
  user: {
    registered(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    active(userId: string, options?: EventOptions): Promise<DeliveryResult>;
  };
  activity(metric: `custom.${string}`, userId: string, options?: ActivityOptions): Promise<DeliveryResult>;
  /** Built-in typed metric calls for typo-safe application instrumentation. */
  events: {
    reportGenerated(userId: string, reportId?: string, options?: EventOptions): Promise<DeliveryResult>;
    recordParsed(userId: string, recordId?: string, options?: EventOptions): Promise<DeliveryResult>;
    trialStarted(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    paidStarted(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    subscriptionCancelled(userId: string, options?: EventOptions): Promise<DeliveryResult>;
  };
  /** Returns protected wire events when mode is memory. */
  capturedEvents(): ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface TelemetryAdapterOptions {
  component?: string;
  /** Trusted route template such as `/projects/:projectId`; raw request URLs are never captured. */
  route?: string;
}
