export const PROTECTED_IDENTITY = /^h1_[a-z0-9-]{1,32}_[A-Za-z0-9_-]{43}$/;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function validIdentityKey(key: string | undefined, keyId: string | undefined): key is string {
  return Boolean(
    key
    && new TextEncoder().encode(key).byteLength >= 32
    && keyId
    && /^[a-z0-9-]{1,32}$/.test(keyId),
  );
}

export async function protectIdentity(value: string, key: string, keyId: string): Promise<string> {
  if (PROTECTED_IDENTITY.test(value)) return value;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return `h1_${keyId}_${bytesToBase64Url(new Uint8Array(signature))}`;
}
