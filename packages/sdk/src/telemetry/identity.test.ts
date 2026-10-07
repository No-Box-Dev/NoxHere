import { describe, expect, it } from "vitest";
import { protectIdentity, validIdentityKey } from "./identity.js";

const key = "identity-secret-key-that-is-at-least-32-bytes";

describe("telemetry identity protection", () => {
  it("matches the shared HMAC vector", async () => {
    await expect(protectIdentity("user-42", key, "primary"))
      .resolves.toBe("h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40");
  });

  it("does not hash an already protected identity twice", async () => {
    const protectedIdentity = await protectIdentity("user-42", key, "primary");
    await expect(protectIdentity(protectedIdentity, key, "primary")).resolves.toBe(protectedIdentity);
  });

  it("requires a bounded key id and at least 32 key bytes", () => {
    expect(validIdentityKey(key, "rotation-2")).toBe(true);
    expect(validIdentityKey("short", "rotation-2")).toBe(false);
    expect(validIdentityKey(key, "INVALID")).toBe(false);
  });
});
