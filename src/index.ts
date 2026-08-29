import { WorkerEntrypoint } from "cloudflare:workers";
import { handleCueEvent } from "./events";
import { buildDigestResponse, buildTestResponse, type MetricComparisons } from "./response";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export default class NoxCueService extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "noxcue", status: "ok" });
    }
    if (url.pathname === "/v1/events") {
      return handleCueEvent(request, this.env);
    }
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        service: "NoxCue",
        message: "Daily app health and immediate explicit errors, delivered to your team and saved for later.",
        ingest: "POST /v1/events",
        types: ["user.registered", "user.active", "error.occurred"],
      });
    }
    return jsonError("not_found", 404);
  }

  buildTestResponse(orgLogin: string) {
    return buildTestResponse(orgLogin);
  }

  buildDigestResponse(
    sourceName: string,
    period: string,
    metrics: Record<string, number>,
    comparisons: MetricComparisons = {},
  ) {
    return buildDigestResponse(sourceName, period, metrics, comparisons);
  }
}
