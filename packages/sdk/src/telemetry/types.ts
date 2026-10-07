import {
  DELIVERY_ERRORS,
  NOXCUE_AUTH_FEATURES,
  NOXCUE_ENVIRONMENTS,
  NOXCUE_OUTCOMES,
  NOXCUE_REASONS,
} from "./contract.js";

export { NOXCUE_AUTH_FEATURES };

export type NoxCueAuthFeature = (typeof NOXCUE_AUTH_FEATURES)[number];
export type NoxCueFeature = NoxCueAuthFeature | `custom.${string}`;
export type NoxCueEnvironment = (typeof NOXCUE_ENVIRONMENTS)[number];
export type NoxCueOutcome = (typeof NOXCUE_OUTCOMES)[number];
export type NoxCueReason = (typeof NOXCUE_REASONS)[number];

export interface DeliveryResult {
  ok: boolean;
  eventId: string;
  status?: number;
  error?: (typeof DELIVERY_ERRORS)[number];
}

export interface NoxCueOptions {
  key: string;
  /** HMAC key used by trusted runtimes to protect user identities before transmission. */
  identityHashKey?: string;
  /** Public identifier for the current identity key. Defaults to `primary`. */
  identityKeyId?: string;
  /** Optional assertion. The source key remains authoritative. */
  environment?: NoxCueEnvironment;
  release?: string;
  endpoint?: string;
  timeoutMs?: number;
  /** Retries after the first attempt. Defaults to 2 and is capped at 3. */
  maxRetries?: number;
  enabled?: boolean;
  /** Supplies the current opaque application identity without retaining profile data. */
  getUser?: () => NoxCueIdentity | null | undefined;
  fetch?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface BrowserNoxCueOptions extends NoxCueOptions {
  /** Explicit opt-in for global error and unhandled-rejection listeners. */
  captureUnhandled?: boolean;
}

export interface NoxCueIdentity {
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

export const NOXCUE_WEBSITE_EVENTS = [
  "website.page_visited",
  "website.demo_clicked",
  "website.signup_clicked",
  "website.pricing_clicked",
  "website.login_clicked",
  "website.contact_clicked",
] as const;

export type NoxCueWebsiteEvent = (typeof NOXCUE_WEBSITE_EVENTS)[number];
export type NoxCueTrackName =
  | "user.registered"
  | "user.active"
  | "subscription.trial_started"
  | "subscription.paid_started"
  | "subscription.cancelled"
  | "records.parsed"
  | "reports.generated"
  | NoxCueWebsiteEvent
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
  fatal?: boolean;
  unhandled?: boolean;
  attributes?: Record<string, string | number | boolean>;
}

export interface ServerErrorOptions extends BrowserErrorOptions {
  fingerprint?: string;
  affectedUser?: string;
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
  /** Sets only an opaque user id; profile fields are deliberately discarded. */
  identify(user: NoxCueIdentity | null): void;
  /** Fire-and-forget error capture. Delivery is tracked by flush(). */
  capture(error: unknown, options?: ErrorOptions): void;
  error(error: unknown, options?: ErrorOptions): Promise<DeliveryResult>;
  test(feature?: NoxCueAuthFeature): Promise<DeliveryResult>;
  flush(): Promise<DeliveryResult[]>;
  close(): void;
}

export interface BrowserNoxCueClient extends BaseNoxCueClient<BrowserErrorOptions> {
  /** Records an anonymous, count-only website event. */
  track(name: NoxCueWebsiteEvent, options?: AnonymousTrackOptions): Promise<DeliveryResult>;
}

export interface ServerNoxCueClient extends BaseNoxCueClient<ServerErrorOptions> {
  /** Records an event; supplied user identities are HMAC-protected before serialization. */
  track(name: NoxCueTrackName, options?: TrackOptions): Promise<DeliveryResult>;
  /** Creates a concurrency-safe view whose feature/error events carry this opaque id. */
  forUser(userId: string): ServerNoxCueClient;
  user: {
    registered(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    active(userId: string, options?: EventOptions): Promise<DeliveryResult>;
  };
  activity(metric: `custom.${string}`, userId: string, options?: ActivityOptions): Promise<DeliveryResult>;
}

export interface NoxCueAdapterOptions {
  component?: string;
  /** Trusted route template such as `/projects/:projectId`; raw request URLs are never captured. */
  route?: string;
}
