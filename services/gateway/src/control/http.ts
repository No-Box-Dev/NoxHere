export function apiResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Link", '</openapi.json>; rel="service-desc"');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return apiResponse({
    apiVersion: 1,
    error: { code, message, ...(details ? { details } : {}) },
  }, status);
}

export async function boundedJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("request_too_large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("request_too_large");
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
