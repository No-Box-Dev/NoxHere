import { describe, expect, it } from "vitest";
import { createTelemetryKey, hashTelemetryKey } from "../../lib/telemetry-settings";

describe("Telemetry ingest-key lifecycle", () => {
  it("uses visibly distinct high-entropy public and server keys and stores only a hash", async () => {
    const publicKey = createTelemetryKey("publishable");
    const secretKey = createTelemetryKey("secret");
    expect(publicKey).toMatch(/^nox_pub_[A-Za-z0-9_-]{43}$/);
    expect(secretKey).toMatch(/^nox_secret_[A-Za-z0-9_-]{43}$/);
    expect(await hashTelemetryKey(secretKey)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashTelemetryKey(secretKey)).not.toContain(secretKey);
  });

  it("creates independent credentials for safe rotation", () => {
    expect(createTelemetryKey("secret")).not.toBe(createTelemetryKey("secret"));
  });
});
