interface ServiceBinding {
  describe(): Promise<unknown>;
  buildGitHubIncident?(input: Record<string, unknown>, previous?: { url: string } | null): Promise<unknown>;
}

interface Env {
  PRODUCT_SERVICE: ServiceBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).searchParams.get("method") === "buildGitHubIncident") {
      const presentation = await env.PRODUCT_SERVICE.buildGitHubIncident?.({
        environment: "test",
        incidentKey: "rpc/health",
        title: "RPC health check",
        payloadJson: JSON.stringify({
          impact: "RPC health check",
          diagnosis: { possibleCauses: ["Test"], possibleFixes: ["Test"] },
        }),
        sourceName: "RPC health",
        firstSeenAt: "2026-01-01T00:00:00Z",
        lastSeenAt: "2026-01-01T00:00:00Z",
        occurrenceCount: 1,
      }, null);
      return Response.json(presentation ?? { error: "missing_buildGitHubIncident" }, {
        status: presentation ? 200 : 500,
      });
    }
    const manifest = await env.PRODUCT_SERVICE.describe();
    return Response.json(manifest);
  },
};
