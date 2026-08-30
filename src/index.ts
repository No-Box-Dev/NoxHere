import { WorkerEntrypoint } from "cloudflare:workers";
import { createChartSnapshot, handleChartImage } from "./chart";
import { handleCueEvent } from "./events";
import { buildDigestResponse, buildTestResponse, type MetricComparisons } from "./response";
import { runEndpointMonitors } from "./monitor";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export default class NoxCueService extends WorkerEntrypoint<Env> {
  async scheduled(): Promise<void> {
    await runEndpointMonitors(this.env);
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const chartResponse = await handleChartImage(request, this.env.NOX_DB);
    if (chartResponse) return chartResponse;
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
        types: ["user.registered", "user.active", "feature.result", "error.occurred"],
      });
    }
    return jsonError("not_found", 404);
  }

  buildTestResponse(orgLogin: string) {
    return buildTestResponse(orgLogin);
  }

  async buildDigestResponse(
    sourceName: string,
    period: string,
    metrics: Record<string, number>,
    comparisons: MetricComparisons = {},
  ) {
    const textFallback = buildDigestResponse(sourceName, period, metrics, comparisons);
    let chartImageUrl: string | undefined;
    try {
      const id = await createChartSnapshot(this.env.NOX_DB, { sourceName, period, metrics, comparisons });
      chartImageUrl = `${this.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/v1/charts/${id}.png`;
    } catch (error) {
      console.error("NoxCue chart snapshot failed", error);
    }
    return chartImageUrl
      ? buildDigestResponse(sourceName, period, metrics, comparisons, chartImageUrl)
      : textFallback;
  }
}
