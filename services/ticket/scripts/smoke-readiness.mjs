const [origin, service, expectedSha] = process.argv.slice(2);
if (!origin || !service || !expectedSha) throw new Error("Usage: smoke-readiness.mjs <origin> <service> <sha>");

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const response = await fetch(new URL("/api/health/ready", origin), { headers: { "Cache-Control": "no-cache" } });
    const health = await response.json();
    if (health?.checks?.[service] === true && health?.versions?.[service] === expectedSha) {
      console.log(JSON.stringify({ origin, service, buildSha: expectedSha, status: "ready" }));
      process.exit(0);
    }
  } catch { /* retry while service bindings converge */ }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
throw new Error(`${service} did not become ready at ${origin} on ${expectedSha}`);
