import { WorkerEntrypoint } from "cloudflare:workers";
import { createChartSnapshot, handleChartImage } from "./chart";
import { handleCueEvent } from "./events";
import { narrateDailyStats } from "./narration";
import { buildDigestResponse, buildTestResponse, type MetricComparisons } from "./response";
import { runEndpointMonitors, testEndpointMonitor } from "./monitor";
import { NOXCUE_SERVICE_MANIFEST } from "./service-manifest";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export default class NoxCueService extends WorkerEntrypoint<Env> {
  describe() {
    return NOXCUE_SERVICE_MANIFEST;
  }
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
        message: "Detect app health failures, preserve safe evidence, and show developers possible fixes to investigate.",
        ingest: "POST /v1/events",
        types: ["user.registered", "user.active", "activity.occurred", "feature.result", "error.occurred"],
      });
    }
    return jsonError("not_found", 404);
  }

  buildTestResponse(orgLogin: string) {
    return buildTestResponse(orgLogin);
  }

  async testEndpointMonitor(orgId: number, sourceId: string) {
    return testEndpointMonitor(this.env, orgId, sourceId);
  }

  async buildDigestResponse(
    sourceName: string,
    period: string,
    metrics: Record<string, number>,
    comparisons: MetricComparisons = {},
    metricLabels: Record<string, string> = {},
  ) {
    const textFallback = buildDigestResponse(sourceName, period, metrics, comparisons, undefined, undefined, metricLabels);
    const chart = (async () => {
      try {
        const id = await createChartSnapshot(this.env.NOX_DB, { sourceName, period, metrics, comparisons, metricLabels });
        return `${this.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/v1/charts/${id}.png`;
      } catch (error) {
        console.error("NoxCue chart snapshot failed", error);
        return undefined;
      }
    })();
    const narration = narrateDailyStats(
      { sourceName, period, metrics, comparisons, metricLabels },
      this.env.ANTHROPIC_API_KEY,
      fetch,
      this.env.NARRATION_MODEL,
    );
    const [chartImageUrl, narrative] = await Promise.all([chart, narration]);
    return chartImageUrl || narrative
      ? buildDigestResponse(sourceName, period, metrics, comparisons, chartImageUrl, narrative, metricLabels)
      : textFallback;
  }
}
