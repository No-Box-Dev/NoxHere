import { validateHealthContracts } from "./check-health-contracts.mjs";

const [origin, expectedService, expectedSha] = process.argv.slice(2);
if (!origin) throw new Error("Usage: check-ecosystem-health.mjs <origin> [service] [sha]");
const waitSeconds = Number(process.env.ECOSYSTEM_HEALTH_WAIT_SECONDS ?? "0");
if (!Number.isInteger(waitSeconds) || waitSeconds < 0) {
  throw new Error("ECOSYSTEM_HEALTH_WAIT_SECONDS must be a non-negative integer");
}
const deadline = Date.now() + waitSeconds * 1000;
const retryIntervalMs = 15_000;

async function json(path) {
  const response = await fetch(new URL(path, origin), {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function check() {
  const [platform, boundary, readiness, contracts] = await Promise.all([
    json("/__noxhere/health"),
    json("/__noxhere/health/private-boundary"),
    json("/api/health/ready"),
    json("/__noxhere/health/contracts"),
  ]);

  if (platform?.service !== "noxhere" || platform?.status !== "ok") {
    throw new Error(`NoxHere health contract failed: ${JSON.stringify(platform)}`);
  }
  if (boundary?.status !== "ok") {
    throw new Error(`Private service boundary is degraded: ${JSON.stringify(boundary)}`);
  }
  const requiredChecks = [
    "database", "backgroundWorker", "deliveryQueue", "connections",
    "planning", "feedback", "telemetry", "activity", "scheduler",
  ];
  if (readiness?.status !== "ok"
    || requiredChecks.some((component) => readiness?.checks?.[component] !== true)) {
    throw new Error(`Ecosystem readiness failed: ${JSON.stringify(readiness)}`);
  }
  if (expectedService && expectedSha && readiness?.versions?.[expectedService] !== expectedSha) {
    throw new Error(`${expectedService} is ${readiness?.versions?.[expectedService] ?? "unknown"}; expected ${expectedSha}`);
  }
  if (expectedSha && readiness?.versions?.telemetry !== expectedSha) {
    throw new Error(`telemetry is ${readiness?.versions?.telemetry ?? "unknown"}; expected ${expectedSha}`);
  }
  if (expectedSha && readiness?.versions?.background !== expectedSha) {
    throw new Error(`background is ${readiness?.versions?.background ?? "unknown"}; expected ${expectedSha}`);
  }
  if (expectedSha) validateHealthContracts(contracts, expectedSha);

  return { platform, readiness, contracts };
}

let result;
while (!result) {
  try {
    result = await check();
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000);
    const delayMs = Math.min(retryIntervalMs, deadline - Date.now());
    console.warn(`Ecosystem is not ready; retrying in ${Math.ceil(delayMs / 1000)}s (${remainingSeconds}s remaining): ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

console.log(JSON.stringify({
  origin,
  platform: result.platform.buildSha,
  versions: result.readiness.versions,
  status: result.readiness.status,
}));
