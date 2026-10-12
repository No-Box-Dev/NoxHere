const [platformOrigin, spotOrigin, expectedSha] = process.argv.slice(2);
if (!platformOrigin || !spotOrigin || !expectedSha) {
  throw new Error("Usage: smoke-deployment.mjs <platform-origin> <spot-origin> <sha>");
}

async function ready() {
  const response = await fetch(new URL("/api/health/ready", platformOrigin), { headers: { "Cache-Control": "no-cache" } });
  const body = await response.json();
  return response.ok
    && body?.checks?.database === true
    && body?.checks?.feedback === true
    && body?.checks?.telemetry === true
    && body?.versions?.noxhere === expectedSha
    && body?.versions?.feedback === expectedSha
    && body?.versions?.telemetry === expectedSha;
}

async function spotReady() {
  const response = await fetch(new URL("/health", spotOrigin), { headers: { "Cache-Control": "no-cache" } });
  const body = await response.json();
  return response.ok && body?.owner === "noxhere" && body?.buildSha === expectedSha;
}

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    if (await ready() && await spotReady()) {
      console.log(JSON.stringify({ platformOrigin, spotOrigin, buildSha: expectedSha, status: "ready" }));
      process.exit(0);
    }
  } catch { /* retry while bindings and routes converge */ }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
throw new Error(`NoxHere release ${expectedSha} did not become ready`);
