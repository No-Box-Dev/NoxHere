import { describe, expect, it } from "vitest";
import { decryptNoxToken } from "../crypto";

describe("decryptNoxToken", () => {
  it("decrypts a token produced by Unticket's encryptToken helper", async () => {
    const key = "01".repeat(32);
    const encrypted = "016ed8f657624ab32a43b6ab:a7d0a254332f41c282e1f4a6b1bfd9406396031ecdb072782fae2da312400d";

    await expect(decryptNoxToken(encrypted, key)).resolves.toBe("xoxb-test-token");
  });

  it("rejects malformed ciphertext", async () => {
    await expect(decryptNoxToken("not-encrypted", "01".repeat(32))).rejects.toThrow();
  });
});
