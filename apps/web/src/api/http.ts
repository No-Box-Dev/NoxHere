import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestScope { organizationId?: string; projectId?: string }

export const AUTH_REQUIRED_EVENT = "noxhere:auth-required";

function requestHeaders(scope?: RequestScope, json = false, extra?: HeadersInit) {
  const methodToken = typeof document === "undefined"
    ? null
    : document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("nox_csrf="))?.slice("nox_csrf=".length) ?? null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(methodToken ? { "X-CSRF-Token": decodeURIComponent(methodToken) } : {}),
    ...(scope?.organizationId ? { "X-Org": scope.organizationId } : {}),
    ...(scope?.projectId ? { "X-Project-ID": scope.projectId } : {}),
    ...(extra as Record<string, string> | undefined),
  };
}

async function checkedResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  return throwApiError(response);
}

async function throwApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null) as { error?: string | { code?: string; message?: string } } | null;
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  const structuredError = typeof body?.error === "object" ? body.error : null;
  throw new ApiError(
    (typeof body?.error === "string" ? body.error : structuredError?.message) ?? `Request failed with status ${response.status}`,
    response.status,
    structuredError?.code ?? "request_failed",
  );
}

export async function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, scope?: RequestScope): Promise<T> {
  const response = await fetch(path, {
    headers: requestHeaders(scope),
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) await throwApiError(response);

  return schema.parse(await response.json());
}

export async function getRawJson(path: string, signal?: AbortSignal, scope?: RequestScope): Promise<unknown> {
  const response = await fetch(path, { headers: requestHeaders(scope), credentials: "same-origin", signal });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

export async function getBlob(path: string, signal?: AbortSignal, scope?: RequestScope): Promise<Blob> {
  const response = await checkedResponse(await fetch(path, { headers: requestHeaders(scope), credentials: "same-origin", signal }));
  return response.blob();
}

export async function postFormJson<T>(path: string, form: FormData, schema: z.ZodType<T>, scope?: RequestScope): Promise<T> {
  const response = await checkedResponse(await fetch(path, {
    method: "POST",
    headers: requestHeaders(scope),
    credentials: "same-origin",
    body: form,
  }));
  return schema.parse(await response.json());
}

export async function getRawJsonWithHeaders<T>(path: string, signal?: AbortSignal, scope?: RequestScope): Promise<{ data: T; headers: Headers }> {
  const response = await checkedResponse(await fetch(path, { headers: requestHeaders(scope), credentials: "same-origin", signal }));
  return { data: await response.json() as T, headers: response.headers };
}

export async function patchRawJson<T>(path: string, body: unknown, headers: HeadersInit, scope?: RequestScope): Promise<T> {
  const response = await checkedResponse(await fetch(path, {
    method: "PATCH",
    headers: requestHeaders(scope, true, headers),
    credentials: "same-origin",
    body: JSON.stringify(body),
  }));
  return response.json() as Promise<T>;
}

export async function postRawJson<T>(path: string, body: unknown, scope?: RequestScope): Promise<T> {
  const response = await checkedResponse(await fetch(path, {
    method: "POST",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
    body: JSON.stringify(body),
  }));
  return response.json() as Promise<T>;
}

export async function putRawJson<T>(path: string, body: unknown, scope?: RequestScope): Promise<T> {
  const response = await checkedResponse(await fetch(path, {
    method: "PUT",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
    body: JSON.stringify(body),
  }));
  return response.json() as Promise<T>;
}

export async function deleteRawJson<T>(path: string, scope?: RequestScope): Promise<T> {
  const response = await checkedResponse(await fetch(path, {
    method: "DELETE",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
  }));
  return response.json() as Promise<T>;
}

export async function patchJson<T>(path: string, body: unknown, schema: z.ZodType<T>, scope?: RequestScope): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response);
  return schema.parse(await response.json());
}

export async function deleteJson<T>(path: string, schema: z.ZodType<T>, scope?: RequestScope): Promise<T> {
  const response = await fetch(path, {
    method: "DELETE",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
  });
  if (!response.ok) await throwApiError(response);
  return schema.parse(await response.json());
}

export async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>, scope?: RequestScope): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response);
  return schema.parse(await response.json());
}

export async function putJson<T>(path: string, body: unknown, schema: z.ZodType<T>, scope?: RequestScope): Promise<T> {
  const response = await fetch(path, {
    method: "PUT",
    headers: requestHeaders(scope, true),
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response);
  return schema.parse(await response.json());
}
