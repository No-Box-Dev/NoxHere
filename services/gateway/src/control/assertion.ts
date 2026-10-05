import type { AuthContext } from "./auth";

const encoder = new TextEncoder();

export interface InternalAssertion {
  version: 1;
  issuer: "noxhere";
  audience: "noxconnect";
  issuedAt: number;
  expiresAt: number;
  method: string;
  path: string;
  auth: AuthContext;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function signedAssertionHeaders(
  request: Request,
  auth: AuthContext,
  secret: string,
): Promise<Headers> {
  const now = Math.floor(Date.now() / 1000);
  const url = new URL(request.url);
  const assertion: InternalAssertion = {
    version: 1,
    issuer: "noxhere",
    audience: "noxconnect",
    issuedAt: now,
    expiresAt: now + 30,
    method: request.method.toUpperCase(),
    path: `${url.pathname}${url.search}`,
    auth,
  };
  const payload = base64Url(encoder.encode(JSON.stringify(assertion)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
  const headers = new Headers(request.headers);
  const internalHeaders: string[] = [];
  headers.forEach((_value, name) => {
    if (name.toLowerCase().startsWith("x-noxhere-internal-")) internalHeaders.push(name);
  });
  for (const name of internalHeaders) headers.delete(name);
  // Public credentials terminate at NoxHere. The connector receives only the
  // short-lived assertion plus non-secret request context such as X-Org and
  // X-Project-ID.
  headers.delete("Authorization");
  headers.delete("Cookie");
  headers.delete("X-CSRF-Token");
  headers.set("X-NoxHere-Internal-Assertion", payload);
  headers.set("X-NoxHere-Internal-Signature", signature);
  return headers;
}
