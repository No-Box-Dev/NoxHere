interface TelemetryServiceBinding extends Fetcher {
  ingestApiTokenEvent?(input: {
    auth: {
      orgId: number;
      projectId: string;
      environment: "production" | "staging" | "test";
      tokenId: string;
      sourceId: string | null;
    };
    body: string;
    contentType: string;
    ip: string | null;
  }): Promise<Response>;
}

interface TelemetryIngestContext {
  env: { TELEMETRY_RESPONSE?: TelemetryServiceBinding };
  request: Request;
  data?: {
    orgId?: number;
    projectId?: string | null;
    auth?: {
      type?: string;
      id?: string;
      tokenEnvironment?: "production" | "staging" | "test" | null;
    };
  };
}

function unavailableResponse(): Response {
  return Response.json(
    { error: "ingest_unavailable" },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "60",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

// Stable same-origin public entry point. Telemetry still owns authentication,
// validation, rate limiting, deduplication, and storage behind the binding.
export async function onRequest(context: TelemetryIngestContext): Promise<Response> {
  const service = context.env.TELEMETRY_RESPONSE;
  if (!service) return unavailableResponse();

  if (context.data?.auth?.type === "api_token") {
    const { orgId, projectId, auth } = context.data;
    if (!orgId || !projectId || !auth.id || !auth.tokenEnvironment) {
      return Response.json({ error: "invalid_api_token_context" }, { status: 401 });
    }
    if (context.request.headers.has("Origin")) {
      return Response.json({ error: "api_token_not_allowed_from_browser" }, { status: 403 });
    }
    if (!service.ingestApiTokenEvent) return unavailableResponse();
    const contentLength = Number(context.request.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 32_768) {
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    }
    const body = await context.request.text();
    if (new TextEncoder().encode(body).byteLength > 32_768) {
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    }
    try {
      return await service.ingestApiTokenEvent({
        auth: {
          orgId,
          projectId,
          environment: auth.tokenEnvironment,
          tokenId: auth.id,
          sourceId: context.request.headers.get("X-Nox-Source-ID")?.trim() || null,
        },
        body,
        contentType: context.request.headers.get("Content-Type") ?? "",
        ip: context.request.headers.get("CF-Connecting-IP"),
      });
    } catch {
      return unavailableResponse();
    }
  }

  const upstreamUrl = new URL(context.request.url);
  upstreamUrl.pathname = "/v1/events";
  const requestInit: RequestInit & { duplex: "half" } = {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.method === "GET" || context.request.method === "HEAD" ? null : context.request.body,
    redirect: context.request.redirect,
    // Required by Node's Request implementation in tests; ignored by workerd.
    duplex: "half",
  };
  const upstreamRequest = new Request(upstreamUrl, requestInit);
  try {
    const response = await service.fetch(upstreamRequest);
    const contentType = response.headers.get("Content-Type") ?? "";
    if (response.status >= 500 && !contentType.includes("application/json")) {
      return unavailableResponse();
    }
    return response;
  } catch {
    return unavailableResponse();
  }
}
