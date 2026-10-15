import { describe, expect, it } from "vitest";
import {
  isLegacyNativeExchangeClient,
  isNativeDeviceClient,
  LEGACY_NATIVE_EXCHANGE_CLIENTS,
  NATIVE_DEVICE_CLIENTS,
} from "../native-clients";

describe("native client compatibility contract", () => {
  it("keeps every shipped caller on the brokered device flow", () => {
    expect(NATIVE_DEVICE_CLIENTS).toEqual([
      "noxhere-cli",
      "noxhere-mac",
      "noxfeed-mac",
      "activity-mac",
    ]);
    for (const client of NATIVE_DEVICE_CLIENTS) expect(isNativeDeviceClient(client)).toBe(true);
    expect(isNativeDeviceClient("retired-product")).toBe(false);
  });

  it("limits provider-credential migration to historical Apple clients", () => {
    expect(LEGACY_NATIVE_EXCHANGE_CLIENTS).toEqual([
      "noxhere-mac",
      "noxfeed-mac",
      "activity-mac",
    ]);
    for (const client of LEGACY_NATIVE_EXCHANGE_CLIENTS) {
      expect(isLegacyNativeExchangeClient(client)).toBe(true);
    }
    expect(isLegacyNativeExchangeClient("noxhere-cli")).toBe(false);
  });
});
