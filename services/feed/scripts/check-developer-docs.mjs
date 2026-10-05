import { readFile } from "node:fs/promises";
import { NOXFEED_SERVICE_MANIFEST } from "../src/service.js";

const source = process.env.NOX_OPENAPI_PATH;
const document = source
  ? JSON.parse(await readFile(source, "utf8"))
  : await fetchPublishedOpenApi();

const failures = [];
const operations = NOXFEED_SERVICE_MANIFEST.service.capabilities
  .flatMap((capability) => capability.operations);

for (const operation of operations) {
  const path = canonicalPath(operation.path);
  const documented = document.paths?.[path]?.[operation.method.toLowerCase()];
  if (!documented) {
    failures.push(`${operation.method} ${path} (${operation.id}) is missing`);
    continue;
  }
  if (documented["x-authentication"] !== operation.authentication) {
    failures.push(`${operation.method} ${path} documents ${documented["x-authentication"] ?? "no"} authentication; manifest requires ${operation.authentication}`);
  }
  const sharedControlPlane = path.startsWith("/api/v1/services/")
    || path.startsWith("/api/v1/integrations/");
  if (!sharedControlPlane && !documented.tags?.includes("Activity")) {
    failures.push(`${operation.method} ${path} is not tagged Activity`);
  }
}

const documentedFields = Object.keys(document.components?.schemas?.NoxFeedConfigPatch?.properties ?? {}).sort();
const manifestFields = [...NOXFEED_SERVICE_MANIFEST.configuration.writableFields].sort();
if (JSON.stringify(documentedFields) !== JSON.stringify(manifestFields)) {
  failures.push(`NoxFeedConfigPatch fields are [${documentedFields.join(", ")}], but the manifest publishes [${manifestFields.join(", ")}]`);
}

if (document.components?.parameters?.projectContext?.required !== false) {
  failures.push("X-Project-ID must remain optional in the public OpenAPI contract");
}

const documentedPaths = new Set(Object.keys(document.paths ?? {}).map(normalizePathTemplate));
const swiftClientPath = process.env.NOXFEED_SWIFT_CLIENT_PATH;
if (swiftClientPath) {
  const swiftClient = await readFile(swiftClientPath, "utf8");
  const clientPaths = [...swiftClient.matchAll(/endpoint\("([^"]+)"\)/g)]
    .map((match) => match[1].split("?")[0])
    .filter((path) => path.startsWith("/api/v1/"));
  for (const clientPath of new Set(clientPaths)) {
    if (!documentedPaths.has(normalizePathTemplate(clientPath))) {
      failures.push(`NoxFeed APIClient calls undocumented path ${clientPath}`);
    }
  }
}

if (failures.length) {
  console.error("Feed changed without matching NoxHere developer documentation:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nUpdate and deploy https://github.com/No-Box-Dev/noxconnect before merging this service change.");
  process.exitCode = 1;
} else {
  console.log(`Developer documentation matches ${operations.length} Feed operations and ${manifestFields.length} writable config field(s).`);
}

function canonicalPath(path) {
  const v1 = path.startsWith("/api/v1/") ? path : path.replace(/^\/api\//, "/api/v1/");
  return v1.replace(/^\/api\/v1\/services\/noxfeed(?=\/|$)/, "/api/v1/services/{service}");
}

async function fetchPublishedOpenApi() {
  const url = process.env.NOX_OPENAPI_URL ?? "https://app.noxhere.com/openapi.json";
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not load canonical developer documentation from ${url}: ${lastError?.message ?? lastError}`);
}

function normalizePathTemplate(value) {
  return value
    .replace(/\\\([^)]*\)/g, "{}")
    .replace(/\{[^}]+\}/g, "{}")
    .replace(/^\/api\/v1\/services\/(?:noxconnect|noxticket|noxfeed|noxspot|noxcue)(?=\/|$)/, "/api/v1/services/{}");
}
