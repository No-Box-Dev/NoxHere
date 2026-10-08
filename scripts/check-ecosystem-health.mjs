const [origin, expectedService, expectedSha] = process.argv.slice(2);
if (!origin) throw new Error("Usage: check-ecosystem-health.mjs <origin> [service] [sha]");

async function json(path) {
  const response = await fetch(new URL(path, origin), {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const [platform, boundary, readiness] = await Promise.all([
  json("/__noxhere/health"),
  json("/__noxhere/health/private-boundary"),
  json("/api/health/ready"),
]);

if (platform?.service !== "noxhere" || platform?.status !== "ok") {
  throw new Error(`NoxHere health contract failed: ${JSON.stringify(platform)}`);
}
if (boundary?.status !== "ok") {
  throw new Error(`Private service boundary is degraded: ${JSON.stringify(boundary)}`);
}
if (readiness?.status !== "ok" || Object.values(readiness?.checks ?? {}).some((value) => value !== true)) {
  throw new Error(`Ecosystem readiness failed: ${JSON.stringify(readiness)}`);
}
if (expectedService && expectedSha && readiness?.versions?.[expectedService] !== expectedSha) {
  throw new Error(`${expectedService} is ${readiness?.versions?.[expectedService] ?? "unknown"}; expected ${expectedSha}`);
}
if (expectedSha && readiness?.versions?.noxcue !== expectedSha) {
  throw new Error(`noxcue is ${readiness?.versions?.noxcue ?? "unknown"}; expected ${expectedSha}`);
}

console.log(JSON.stringify({ origin, platform: platform.buildSha, versions: readiness.versions, status: "ready" }));
