function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) throw new Error("Malformed hex");
  return new Uint8Array(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

/** Compatible with Unticket's AES-256-GCM `iv:ciphertext` token format. */
export async function decryptNoxToken(encrypted: string, hexKey: string): Promise<string> {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
  }
  const parts = encrypted.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Malformed encrypted token");
  const key = await crypto.subtle.importKey(
    "raw",
    fromHex(hexKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(parts[0]) },
    key,
    fromHex(parts[1]),
  );
  return new TextDecoder().decode(plaintext);
}
