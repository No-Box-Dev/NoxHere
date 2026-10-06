import type { CredentialProvider } from "./client.js";

export interface NativeSessionState {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  user?: unknown;
  organizations?: unknown[];
}

export interface NativeSessionStorage {
  load(): NativeSessionState | null | Promise<NativeSessionState | null>;
  save(session: NativeSessionState): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface NativeAuthOptions {
  client: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  storage?: NativeSessionStorage;
  session?: NativeSessionState;
  refreshSkewMs?: number;
  now?: () => number;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode?: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn?: number;
  interval?: number;
}

export interface NativeAuth {
  start(): Promise<DeviceAuthorization>;
  poll(deviceCode: string): Promise<NativeSessionState | null>;
  setSession(session: NativeSessionState): Promise<void>;
  current(): Promise<NativeSessionState | null>;
  accessToken: CredentialProvider;
  revoke(): Promise<void>;
}

function endpoint(baseUrl: string, path: string): URL {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (response.ok && !body.error) return body;
  const structured = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : undefined;
  const message = typeof structured?.message === "string" ? structured.message
    : typeof body.error_description === "string" ? body.error_description
      : typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
  const error = new Error(message) as Error & { status: number; code?: string; retryAfter?: number };
  error.status = response.status;
  error.code = typeof structured?.code === "string" ? structured.code : typeof body.error === "string" ? body.error : undefined;
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter)) error.retryAfter = retryAfter;
  throw error;
}

function normalizedSession(result: Record<string, unknown>, previous?: NativeSessionState | null): NativeSessionState {
  if (typeof result.access_token !== "string" || !result.access_token.startsWith("nox_at_")
      || typeof result.refresh_token !== "string" || !result.refresh_token.startsWith("nox_rt_")) {
    throw new Error("Authentication completed without valid NoxHere session credentials");
  }
  const expiresIn = typeof result.expires_in === "number" ? result.expires_in : Number(result.expires_in) || 900;
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    accessExpiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    ...(result.user !== undefined || previous?.user !== undefined ? { user: result.user ?? previous?.user } : {}),
    ...(Array.isArray(result.organizations) || previous?.organizations ? { organizations: Array.isArray(result.organizations) ? result.organizations : previous?.organizations } : {}),
  };
}

export function createNativeAuth(options: NativeAuthOptions): NativeAuth {
  const baseUrl = options.baseUrl ?? "https://app.noxhere.com";
  const request = options.fetch ?? globalThis.fetch;
  if (!request) throw new TypeError("NoxHere native authentication requires fetch");
  const now = options.now ?? Date.now;
  const refreshSkewMs = Math.max(0, options.refreshSkewMs ?? 30_000);
  let memory = options.session ?? null;
  let refreshPromise: Promise<NativeSessionState> | null = null;

  const load = async () => options.storage ? await options.storage.load() : memory;
  const save = async (session: NativeSessionState) => {
    memory = session;
    await options.storage?.save(session);
  };
  const clear = async () => {
    memory = null;
    await options.storage?.clear();
  };
  const post = async (path: string, body: Record<string, unknown>) => responseJson(await request(endpoint(baseUrl, path), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-NoxHere-SDK": "typescript/0.2.0" },
    body: JSON.stringify(body),
  }));

  const refresh = async (session: NativeSessionState): Promise<NativeSessionState> => {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const result = await post("/api/v1/auth/native/refresh", { refresh_token: session.refreshToken });
        const next = normalizedSession(result, session);
        await save(next);
        return next;
      })().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  };

  return {
    async start() {
      const result = await post("/api/v1/auth/native/device/start", { client: options.client });
      if (typeof result.device_code !== "string" || typeof result.verification_uri !== "string") {
        throw new Error("NoxHere returned an invalid device authorization");
      }
      return {
        deviceCode: result.device_code,
        verificationUri: result.verification_uri,
        ...(typeof result.user_code === "string" ? { userCode: result.user_code } : {}),
        ...(typeof result.verification_uri_complete === "string" ? { verificationUriComplete: result.verification_uri_complete } : {}),
        ...(typeof result.expires_in === "number" ? { expiresIn: result.expires_in } : {}),
        ...(typeof result.interval === "number" ? { interval: result.interval } : {}),
      };
    },
    async poll(deviceCode) {
      const result = await post("/api/v1/auth/native/device/poll", { client: options.client, device_code: deviceCode });
      if (!result.access_token) return null;
      const session = normalizedSession(result, await load());
      await save(session);
      return session;
    },
    async setSession(session) { await save(session); },
    current: load,
    async accessToken() {
      const session = await load();
      if (!session) return undefined;
      if (Date.parse(session.accessExpiresAt) > now() + refreshSkewMs) return session.accessToken;
      return (await refresh(session)).accessToken;
    },
    async revoke() {
      const session = await load();
      if (session) await post("/api/v1/auth/native/revoke", { refresh_token: session.refreshToken });
      await clear();
    },
  };
}
