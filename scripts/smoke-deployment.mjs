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

async function publicRoutesReady() {
  const headers = { "Cache-Control": "no-cache" };
  const privateBoundary = await fetch(new URL("/__noxhere/health/private-boundary", platformOrigin), { headers });
  const privateBoundaryBody = await privateBoundary.json().catch(() => null);
  if (!privateBoundary.ok
      || privateBoundaryBody?.status !== "ok"
      || privateBoundaryBody?.downstreamStatus !== 200) return false;

  const profile = await fetch(new URL("/api/auth/profile", platformOrigin), { headers });
  const profileBody = await profile.json().catch(() => null);
  if (profile.status !== 401
      || !profile.headers.get("content-type")?.includes("application/json")
      || profileBody?.error?.code !== "unauthorized") return false;

  // A missing widget must still be answered by Feedback as JavaScript. The
  // SPA fallback previously returned index.html with HTTP 200, which then
  // failed in browsers as `Unexpected token '<'`.
  const widget = await fetch(new URL("/widget/__noxhere_smoke_missing__.js", platformOrigin), { headers });
  const widgetBody = await widget.text();
  if (widget.status !== 404
      || !widget.headers.get("content-type")?.includes("javascript")
      || widgetBody.trimStart().startsWith("<")) return false;

  const shell = await fetch(new URL("/", platformOrigin), { headers });
  const shellBody = await shell.text();
  const entryPath = shellBody.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  if (!shell.ok || !entryPath) return false;
  const entry = await fetch(new URL(entryPath, platformOrigin), { headers });
  const entryPrefix = (await entry.text()).trimStart().slice(0, 1);
  return entry.ok
    && Boolean(entry.headers.get("content-type")?.includes("javascript"))
    && entryPrefix !== "<";
}

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    // Production serves the app and public Feedback API from the same origin.
    // Readiness already probes Feedback through its service binding and checks
    // its exact build SHA, while /health on the app origin intentionally serves
    // the SPA. Staging keeps a dedicated Feedback origin and probes it directly.
    if (await ready()
        && await publicRoutesReady()
        && (spotOrigin === platformOrigin || await spotReady())) {
      console.log(JSON.stringify({ platformOrigin, spotOrigin, buildSha: expectedSha, status: "ready" }));
      process.exit(0);
    }
  } catch { /* retry while bindings and routes converge */ }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
throw new Error(`NoxHere release ${expectedSha} did not become ready`);
