import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HUMAN_RESOLUTION_OPERATION = "reopenResolvedFeedbackReport";
const IDEMPOTENT_ANONYMOUS_OPERATION = "revokeNativeSession";

export function operationsFromSpec(spec) {
  const operations = [];
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method)) continue;
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId ?? null,
        security: operation.security ?? spec.security ?? [],
      });
    }
  }
  return operations;
}

export function requiresAuthentication(security) {
  return Array.isArray(security)
    && security.length > 0
    && security.every((requirement) => Object.keys(requirement ?? {}).length > 0);
}

export function probePath(path) {
  return path.replace(/\{[^}]+\}/g, "__noxhere_probe__");
}

function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function classifyProbe(operation, response, body) {
  const failures = [];
  const contentType = response.headers.get("content-type") ?? "";
  const html = /text\/html/i.test(contentType) || /^\s*</.test(body);
  const secured = requiresAuthentication(operation.security);
  const write = !SAFE_METHODS.has(operation.method);
  const json = parseJson(body);

  if (response.status >= 500) {
    failures.push(`returned server error ${response.status}`);
  }
  if (response.status >= 300 && response.status < 400) {
    failures.push(`unexpectedly redirected with ${response.status}`);
  }

  if (secured) {
    if (response.status !== 401) {
      failures.push(`secured operation returned ${response.status} instead of 401`);
    } else if (!/application\/json/i.test(contentType)
      || json?.apiVersion !== 1
      || json?.error?.code !== "unauthorized") {
      failures.push("secured operation did not return the canonical unauthorized envelope");
    }
  }

  if (html) {
    const intentionalHumanResponse = operation.operationId === HUMAN_RESOLUTION_OPERATION
      && response.status === 404
      && body.includes("expired or has already been used");
    if (!intentionalHumanResponse) failures.push("API operation returned HTML");
  }

  if (!secured && write && response.status >= 200 && response.status < 300) {
    const intentionalNoop = operation.operationId === IDEMPOTENT_ANONYMOUS_OPERATION
      && response.status === 200
      && json?.revoked === false;
    if (!intentionalNoop) failures.push("anonymous write unexpectedly succeeded");
  }

  return failures;
}

export async function probeDeployment({
  origin,
  localSpec,
  fetchImpl = fetch,
  concurrency = 6,
  timeoutMs = 15_000,
  contractAttempts = 6,
  contractRetryMs = 5_000,
  sleepImpl = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) {
  const base = new URL(origin);
  let deployedSpec;
  let contractStatus = 0;
  for (let attempt = 1; attempt <= contractAttempts; attempt += 1) {
    const contractUrl = new URL("/openapi.json", base);
    contractUrl.searchParams.set("nox_release_probe", `${Date.now()}-${attempt}`);
    const contractResponse = await fetchImpl(contractUrl, {
      headers: { "Cache-Control": "no-cache", Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    contractStatus = contractResponse.status;
    if (contractResponse.ok) {
      deployedSpec = await contractResponse.json();
      if (isDeepStrictEqual(deployedSpec, localSpec)) break;
    }
    if (attempt < contractAttempts) await sleepImpl(contractRetryMs);
  }
  if (!deployedSpec) {
    throw new Error(`Deployed OpenAPI contract returned ${contractStatus}`);
  }
  const operations = operationsFromSpec(localSpec);
  if (!isDeepStrictEqual(deployedSpec, localSpec)) {
    return {
      origin: base.origin,
      contractMatches: false,
      paths: Object.keys(deployedSpec.paths ?? {}).length,
      operations: operationsFromSpec(deployedSpec).length,
      statusCounts: {},
      failures: [{ operationId: null, method: "GET", path: "/openapi.json", reasons: ["deployed contract differs from the repository contract"] }],
    };
  }

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < operations.length) {
      const operation = operations[cursor];
      cursor += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const write = !SAFE_METHODS.has(operation.method);
        const response = await fetchImpl(new URL(probePath(operation.path), base), {
          method: operation.method,
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "User-Agent": "noxhere-api-surface-probe/1.0",
          },
          ...(write ? { body: "{}" } : {}),
        });
        const body = operation.method === "HEAD" ? "" : await response.text();
        results.push({
          ...operation,
          status: response.status,
          reasons: classifyProbe(operation, response, body),
        });
      } catch (error) {
        results.push({
          ...operation,
          status: 0,
          reasons: [error instanceof Error ? error.message : String(error)],
        });
      } finally {
        clearTimeout(timer);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const statusCounts = {};
  for (const result of results) {
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
  }
  return {
    origin: base.origin,
    contractMatches: true,
    paths: Object.keys(localSpec.paths ?? {}).length,
    operations: operations.length,
    statusCounts,
    failures: results
      .filter((result) => result.reasons.length > 0)
      .map(({ operationId, method, path, status, reasons }) => ({ operationId, method, path, status, reasons })),
  };
}

async function main() {
  const [origin, contractPath = "public/openapi.json"] = process.argv.slice(2);
  if (!origin) {
    throw new Error("Usage: probe-openapi-deployment.mjs <origin> [openapi-path]");
  }
  const localSpec = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const result = await probeDeployment({ origin, localSpec });
  console.log(JSON.stringify(result));
  if (!result.contractMatches || result.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
