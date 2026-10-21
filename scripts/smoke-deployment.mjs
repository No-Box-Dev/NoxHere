import { NATIVE_DEVICE_CLIENTS } from "../packages/contracts/native-clients.ts";

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
  const smokeUrl = (path) => {
    const url = new URL(path, platformOrigin);
    url.searchParams.set("__noxhere_smoke", expectedSha);
    return url;
  };
  const privateBoundary = await fetch(smokeUrl("/__noxhere/health/private-boundary"), { headers });
  const privateBoundaryBody = await privateBoundary.json().catch(() => null);
  if (!privateBoundary.ok
      || privateBoundaryBody?.status !== "ok"
      || privateBoundaryBody?.downstreamStatus !== 200) return false;

  const identityBoundary = await fetch(smokeUrl("/__noxhere/health/identity-boundary"), { headers });
  const identityBoundaryBody = await identityBoundary.json().catch(() => null);
  if (!identityBoundary.ok || identityBoundaryBody?.status !== "ok") return false;

  const providerIngress = await fetch(smokeUrl("/__noxhere/health/provider-ingress"), { headers });
  const providerIngressBody = await providerIngress.json().catch(() => null);
  if (!providerIngress.ok
      || providerIngressBody?.status !== "ok"
      || providerIngressBody?.checks?.github !== true
      || providerIngressBody?.checks?.slack !== true
      || providerIngressBody?.checks?.postmark !== true) return false;

  const live = await fetch(smokeUrl("/__noxhere/health/live"), { headers });
  const liveBody = await live.json().catch(() => null);
  if (!live.ok
      || liveBody?.kind !== "liveness"
      || liveBody?.service !== "gateway"
      || liveBody?.buildSha !== expectedSha) return false;

  const contracts = await fetch(smokeUrl("/__noxhere/health/contracts"), { headers });
  const contractsBody = await contracts.json().catch(() => null);
  if (!contracts.ok
      || contractsBody?.kind !== "health-contracts"
      || contractsBody?.buildSha !== expectedSha
      || !Array.isArray(contractsBody?.services)
      || contractsBody.services.length !== 8
      || contractsBody.services.some((service) => service.live !== true
        || service.ready !== true
        || service.buildSha !== expectedSha)) return false;

  const profile = await fetch(smokeUrl("/api/auth/profile"), { headers });
  const profileBody = await profile.json().catch(() => null);
  if (profile.status !== 401
      || !profile.headers.get("content-type")?.includes("application/json")
      || profileBody?.error?.code !== "unauthorized") return false;

  // A missing widget must still be answered by Feedback as JavaScript. The
  // SPA fallback previously returned index.html with HTTP 200, which then
  // failed in browsers as `Unexpected token '<'`.
  const widget = await fetch(smokeUrl("/widget/__noxhere_smoke_missing__.js"), { headers });
  const widgetBody = await widget.text();
  if (widget.status !== 404
      || !widget.headers.get("content-type")?.includes("javascript")
      || widgetBody.trimStart().startsWith("<")) return false;

  const shell = await fetch(smokeUrl("/"), { headers });
  const shellBody = await shell.text();
  const entryPath = shellBody.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  if (!shell.ok || !entryPath) return false;
  const entry = await fetch(new URL(entryPath, platformOrigin), { headers });
  const entryPrefix = (await entry.text()).trimStart().slice(0, 1);
  const assetsReady = entry.ok
    && Boolean(entry.headers.get("content-type")?.includes("javascript"))
    && entryPrefix !== "<";
  if (!assetsReady) return false;

  // A stale tab may ask for a hashed chunk from the previous release. The
  // asset binding uses an SPA fallback, so explicitly prove that an absent
  // module is a non-cacheable 404 rather than index.html with HTTP 200.
  const missingModule = await fetch(smokeUrl("/assets/__noxhere_missing_build_chunk__.js"), { headers });
  if (missingModule.status !== 404
      || missingModule.headers.get("content-type")?.includes("text/html")
      || missingModule.headers.get("x-noxhere-asset-miss") !== "1") return false;

  // Keep every shipped native client able to begin GitHub device login. An
  // older gateway deployment once accepted the CLI while returning 400 to
  // both the current NoxHere app and the installed NoxFeed App Store build.
  // Unit tests did not catch the deployed-code regression, so make this a
  // release gate against the actual staging and production origins.
  const nativeResults = await Promise.all(NATIVE_DEVICE_CLIENTS.map(async (client) => {
    const response = await fetch(smokeUrl("/api/v1/auth/native/device/start"), {
      method: "POST",
      headers: { ...headers, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client }),
    });
    const body = await response.json().catch(() => null);
    return response.status === 200
      && typeof body?.device_code === "string"
      && body.device_code.startsWith("noxid_")
      && typeof body?.user_code === "string"
      && typeof body?.verification_uri === "string";
  }));
  return nativeResults.every(Boolean);
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
