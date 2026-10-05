import { spawn } from "node:child_process";
import { platform } from "node:os";

export const NATIVE_CLIENT = "noxconnect-cli";
export const DEFAULT_API_BASE = "https://app.noxhere.com";

function endpoint(base, path) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`);
}

async function jsonResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (response.ok && !body?.error) return body;
  const message = body?.error?.message || body?.error_description || body?.error || `HTTP ${response.status}`;
  const error = new Error(String(message));
  error.status = response.status;
  error.code = body?.error?.code || body?.error;
  error.retryAfter = Number(response.headers.get("retry-after")) || null;
  throw error;
}

export async function startLogin({ baseURL = DEFAULT_API_BASE, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint(baseURL, "/api/v1/auth/native/device/start"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client: NATIVE_CLIENT }),
  });
  return jsonResponse(response);
}

export async function pollLogin(deviceCode, { baseURL = DEFAULT_API_BASE, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint(baseURL, "/api/v1/auth/native/device/poll"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client: NATIVE_CLIENT, device_code: deviceCode }),
  });
  return jsonResponse(response);
}

export async function refreshSession(refreshToken, { baseURL = DEFAULT_API_BASE, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint(baseURL, "/api/v1/auth/native/refresh"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return jsonResponse(response);
}

export async function revokeSession(refreshToken, { baseURL = DEFAULT_API_BASE, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint(baseURL, "/api/v1/auth/native/revoke"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return jsonResponse(response);
}

export function normalizedSession(result, previous = {}) {
  if (typeof result?.access_token !== "string" || !result.access_token.startsWith("nox_at_")
      || typeof result?.refresh_token !== "string" || !result.refresh_token.startsWith("nox_rt_")) {
    throw new Error("Authentication completed without valid NoxConnect session credentials.");
  }
  const expiresIn = Number(result.expires_in) || 900;
  return {
    version: 1,
    apiBase: previous.apiBase || DEFAULT_API_BASE,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    accessExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    user: result.user || previous.user,
    organizations: result.organizations || previous.organizations || [],
    context: previous.context || null,
  };
}

export async function openBrowser(url) {
  const command = platform() === "darwin"
    ? ["open", [url]]
    : platform() === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
  child.unref();
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
