import { createTestHarness } from "wrangler";
import process from "node:process";

const [telemetryConfig] = process.argv.slice(2);
if (!telemetryConfig) {
  console.error("Usage: node scripts/check-telemetry-capability.mjs <telemetry-wrangler-config>");
  process.exitCode = 2;
} else {
  const server = createTestHarness({ workers: [
    { configPath: telemetryConfig, bindingOverrides: { NOXHERE_CAPABILITIES: "fake-connection-capability" } },
    { configPath: "scripts/fake-connection-capability/wrangler.jsonc" },
  ] });
  try {
    await server.listen();
    const telemetry = await server.getWorker("noxhere-telemetry").getExport();
    const response = await telemetry.buildDigestResponse(
      "Playnist", "2026-09-05",
      { "users.new": 12 },
      { "users.new": { yesterday: 8, average30d: 9.5, sampleDays: 30 } },
      {},
      { organizationId: 1, projectId: "project-1", sourceId: "source-1" },
    );
    if (response?.contract !== "telemetry.response" || !JSON.stringify(response).includes("12 new users")) {
      throw new Error(`Telemetry capability RPC failed: ${JSON.stringify(response)}`);
    }
    const incident = await telemetry.buildGitHubIncident({
      environment: "production",
      incidentKey: "capability/synthetic",
      title: "Synthetic capability check",
      payloadJson: JSON.stringify({
        impact: "Synthetic capability check.",
        diagnosis: { possibleCauses: [], possibleFixes: [] },
      }),
      sourceName: "Telemetry capability check",
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      occurrenceCount: 1,
    });
    if (incident?.contract !== "telemetry.response" || incident?.kind !== "github_incident"
      || typeof incident?.marker !== "string" || typeof incident?.body !== "string") {
      throw new Error(`Telemetry incident RPC failed: ${JSON.stringify(incident)}`);
    }
    console.log(JSON.stringify({
      service: "telemetry",
      rpc: "pass",
      capabilities: ["daily_digest", "github_incident"],
      credentialInProduct: false,
    }));
  } finally { await server.close(); }
}
