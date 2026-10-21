import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HEALTH_SERVICES = [
  "connections", "telemetry", "activity", "planning",
  "feedback", "core-api", "scheduler", "gateway",
];

const SOURCES = {
  connections: "services/connections/src/provider-ingress.ts",
  telemetry: "services/telemetry/src/index.ts",
  activity: "services/activity/src/index.js",
  planning: "services/planning/src/index.ts",
  feedback: "services/feedback/src/index.ts",
  "core-api": "functions/api/health",
  scheduler: "services/scheduler/src/index.js",
  gateway: "services/gateway/src/index.ts",
};

function fail(message) {
  throw new Error(`Health contract verification failed: ${message}`);
}

export function validateHealthContracts(body, expectedSha) {
  if (body?.contractVersion !== 1 || body?.kind !== "health-contracts") fail("invalid aggregate contract");
  if (body.status !== "ok") fail(`aggregate status is ${body?.status ?? "missing"}`);
  if (body.buildSha !== expectedSha) fail(`aggregate release is ${body?.buildSha ?? "missing"}, expected ${expectedSha}`);
  if (!Array.isArray(body.services)) fail("services must be an array");
  const seen = new Set();
  for (const service of body.services) {
    if (!HEALTH_SERVICES.includes(service?.service)) fail(`unexpected service ${service?.service ?? "missing"}`);
    if (seen.has(service.service)) fail(`duplicate service ${service.service}`);
    seen.add(service.service);
    if (service.live !== true) fail(`${service.service} is not live`);
    if (service.ready !== true) fail(`${service.service} is not ready`);
    if (service.buildSha !== expectedSha) fail(`${service.service} is ${service.buildSha ?? "missing"}, expected ${expectedSha}`);
  }
  for (const service of HEALTH_SERVICES) if (!seen.has(service)) fail(`${service} is missing`);
  return body;
}

export function verifyStaticCoverage() {
  for (const [service, relative] of Object.entries(SOURCES)) {
    if (service === "core-api") {
      for (const file of ["live.ts", "ready.ts", "contracts.ts"]) {
        readFileSync(resolve(root, relative, file), "utf8");
      }
      continue;
    }
    const source = readFileSync(resolve(root, relative), "utf8");
    if (!source.includes("/health/live") && !source.includes("/__noxhere/health/live")) fail(`${service} has no liveness route`);
    if (!source.includes("/health/ready") && !source.includes("/__noxhere/health/ready")) fail(`${service} has no readiness route`);
  }
  const coreConfig = JSON.parse(readFileSync(resolve(root, "services/core-api/wrangler.jsonc"), "utf8"));
  for (const environment of [coreConfig.services, coreConfig.env?.staging?.services]) {
    if (!environment?.some(({ binding }) => binding === "BACKGROUND_SERVICE")) {
      fail("core-api is missing the scheduler health binding");
    }
  }
  return { services: HEALTH_SERVICES.length };
}

async function verifyDeployed(origin, expectedSha) {
  const waitSeconds = Number(process.env.HEALTH_CONTRACT_WAIT_SECONDS ?? "0");
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0) fail("HEALTH_CONTRACT_WAIT_SECONDS must be a non-negative integer");
  const deadline = Date.now() + waitSeconds * 1000;
  let lastError;
  do {
    try {
      const response = await fetch(new URL("/__noxhere/health/contracts", origin), {
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) fail(`aggregate endpoint returned ${response.status}: ${JSON.stringify(body)}`);
      return validateHealthContracts(body, expectedSha);
    } catch (error) {
      lastError = error;
      if (Date.now() >= deadline) break;
      const delay = Math.min(15_000, deadline - Date.now());
      console.warn(`Health contracts are not ready; retrying in ${Math.ceil(delay / 1000)}s: ${error.message}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
    }
  } while (Date.now() <= deadline);
  throw lastError;
}

export async function main(args = process.argv.slice(2)) {
  const coverage = verifyStaticCoverage();
  if (args.length === 0 || (args.length === 1 && args[0] === "--contract")) {
    process.stdout.write(`${JSON.stringify({ status: "covered", ...coverage })}\n`);
    return;
  }
  if (args.length !== 2) fail("usage: check-health-contracts.mjs [<origin> <sha>]");
  const [origin, expectedSha] = args;
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) fail("sha must be a full commit SHA");
  const body = await verifyDeployed(origin, expectedSha);
  process.stdout.write(`${JSON.stringify({ status: "ready", origin, buildSha: body.buildSha, services: body.services.length })}\n`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
