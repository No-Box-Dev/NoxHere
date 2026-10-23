import './check-node-version.mjs';
import { createTestHarness } from "wrangler";
import process from "node:process";

const [configPath] = process.argv.slice(2);
if (!configPath) process.exitCode = 2;
else {
  const server = createTestHarness({ workers: [
    { configPath, bindingOverrides: {
      NOXHERE: "fake-connection-capability",
      TELEMETRY_INGEST: "fake-connection-capability",
    } },
    { configPath: "scripts/fake-connection-capability/wrangler.jsonc" },
  ] });
  try {
    await server.listen();
    const worker = server.getWorker("noxhere-feedback");
    const api = await worker.getExport();
    const manifest = await api.describe();
    const health = await worker.fetch("/health");
    const body = await health.json();
    if (manifest?.service?.id !== "feedback" || body?.owner !== "noxhere") throw new Error("Feedback runtime health failed");
    console.log(JSON.stringify({ service: "feedback", rpc: "pass", runtimeOwner: body.owner, providerCredentials: false }));
  } finally { await server.close(); }
}
