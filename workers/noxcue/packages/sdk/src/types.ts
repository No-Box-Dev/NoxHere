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
  environment: NoxCueEnvironment;
  release?: string;
  endpoint?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
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
  error(error: unknown, options?: ErrorOptions): Promise<DeliveryResult>;
  test(feature?: NoxCueAuthFeature): Promise<DeliveryResult>;
  flush(): Promise<DeliveryResult[]>;
}

export type BrowserNoxCueClient = BaseNoxCueClient<BrowserErrorOptions>;

export interface ServerNoxCueClient extends BaseNoxCueClient<ServerErrorOptions> {
  user: {
    registered(userId: string, options?: EventOptions): Promise<DeliveryResult>;
    active(userId: string, options?: EventOptions): Promise<DeliveryResult>;
  };
  activity(metric: `custom.${string}`, userId: string, options?: ActivityOptions): Promise<DeliveryResult>;
}
