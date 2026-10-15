/**
 * Native callers accepted by the brokered GitHub device flow.
 *
 * The legacy Apple identifiers are wire compatibility contracts for already
 * installed releases. Removing either one strands those installations before
 * they can upgrade, so changes to this list require a deployed-client audit.
 */
export const NATIVE_DEVICE_CLIENTS = [
  "noxhere-cli",
  "noxhere-mac",
  "noxfeed-mac",
  "activity-mac",
] as const;

export type NativeDeviceClient = typeof NATIVE_DEVICE_CLIENTS[number];

/** Only Apple releases ever held provider credentials that require exchange. */
export const LEGACY_NATIVE_EXCHANGE_CLIENTS = [
  "noxhere-mac",
  "noxfeed-mac",
  "activity-mac",
] as const;

export type LegacyNativeExchangeClient = typeof LEGACY_NATIVE_EXCHANGE_CLIENTS[number];

export interface NativeIdentityExchangeResult {
  version: 1;
  connectionId: string;
  user: { id: number; login: string; avatarUrl: string | null };
  organizations: Array<{ id: number; login: string; role: "member" | "admin" }>;
}

export interface NativeDeviceStartResult {
  version: 1;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type NativeDevicePollResult =
  | { version: 1; status: "pending" | "slow_down"; retryAfter: number }
  | { version: 1; status: "expired" | "denied" }
  | ({ version: 1; status: "complete" } & NativeIdentityExchangeResult);

export function isNativeDeviceClient(value: unknown): value is NativeDeviceClient {
  return typeof value === "string"
    && (NATIVE_DEVICE_CLIENTS as readonly string[]).includes(value);
}

export function isLegacyNativeExchangeClient(value: unknown): value is LegacyNativeExchangeClient {
  return typeof value === "string"
    && (LEGACY_NATIVE_EXCHANGE_CLIENTS as readonly string[]).includes(value);
}
