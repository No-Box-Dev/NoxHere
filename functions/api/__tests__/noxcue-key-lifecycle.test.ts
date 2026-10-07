import { describe, expect, it } from "vitest";
import { createCueKey, hashCueKey } from "../../lib/noxcue-settings";

describe("NoxCue ingest-key lifecycle", () => {
  it("uses visibly distinct high-entropy public and server keys and stores only a hash", async () => {
    const publicKey = createCueKey("publishable");
    const secretKey = createCueKey("secret");
    expect(publicKey).toMatch(/^nox_pub_[A-Za-z0-9_-]{43}$/);
    expect(secretKey).toMatch(/^nox_secret_[A-Za-z0-9_-]{43}$/);
    expect(await hashCueKey(secretKey)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashCueKey(secretKey)).not.toContain(secretKey);
  });

  it("creates independent credentials for safe rotation", () => {
    expect(createCueKey("secret")).not.toBe(createCueKey("secret"));
  });
});
