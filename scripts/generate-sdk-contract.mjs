import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("../public/openapi.json", import.meta.url);
const outputUrl = new URL("../packages/sdk-contract/public-api.json", import.meta.url);
const methods = new Set(["get", "post", "put", "patch", "delete"]);

export const namespaceForTag = Object.freeze({
  NoxConnect: "workspace",
  Activity: "activity",
  NoxTicket: "planning",
  NoxSpot: "feedback",
  NoxCue: "incidents",
  Workspace: "workspace",
  Planning: "planning",
  Feedback: "feedback",
  Incidents: "incidents",
});

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

function resolvePointer(document, pointer) {
  if (!pointer.startsWith("#/")) throw new Error(`Only local OpenAPI references are supported: ${pointer}`);
  return pointer.slice(2).split("/").reduce((value, token) => {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    return value && typeof value === "object" ? value[key] : undefined;
  }, document);
}

function validateReferences(document) {
  const visit = (value, location) => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${location}[${index}]`));
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && resolvePointer(document, value.$ref) === undefined) {
      throw new Error(`Unresolved OpenAPI reference ${value.$ref} at ${location}`);
    }
    for (const [key, child] of Object.entries(value)) visit(child, `${location}.${key}`);
  };
  visit(document, "$openapi");
}

function contentTypes(content) {
  return Object.keys(content ?? {}).sort();
}

export function buildSdkContract(document) {
  if (document.openapi !== "3.1.0") throw new Error(`Expected OpenAPI 3.1.0, received ${document.openapi ?? "nothing"}`);
  validateReferences(document);
  const operations = [];
  const ids = new Set();
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      if (!operation.operationId) throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
      if (ids.has(operation.operationId)) throw new Error(`Duplicate operationId: ${operation.operationId}`);
      ids.add(operation.operationId);
      const tag = operation.tags?.[0];
      const namespace = namespaceForTag[tag];
      if (!namespace) throw new Error(`No SDK namespace for ${operation.operationId} tag ${tag ?? "<missing>"}`);
      if (!operation["x-authentication"]) throw new Error(`${operation.operationId} has no x-authentication classification`);
      if (!operation["x-change-safety"]) throw new Error(`${operation.operationId} has no x-change-safety classification`);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        throw new Error(`${operation.operationId} has no responses`);
      }
      operations.push({
        id: operation.operationId,
        method: method.toUpperCase(),
        path,
        namespace,
        tag,
        summary: operation.summary ?? "",
        description: operation.description ?? "",
        authentication: operation["x-authentication"],
        automationScope: operation["x-automation-scope"] ?? null,
        projectScope: operation["x-project-scope"] ?? "none",
        changeSafety: operation["x-change-safety"],
        security: operation.security ?? document.security ?? [],
        servers: operation.servers ?? [],
        parameters: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])],
        requestBody: operation.requestBody ?? null,
        responses: operation.responses,
        requestContentTypes: contentTypes(operation.requestBody?.content),
        responseContentTypes: [...new Set(Object.values(operation.responses)
          .flatMap((response) => contentTypes(response?.content)))].sort(),
      });
    }
  }
  operations.sort((left, right) => left.id.localeCompare(right.id));
  const canonicalSource = JSON.stringify(sorted(document));
  return sorted({
    ...document,
    "x-sdk-contract-version": 1,
    "x-sdk-source": "public/openapi.json",
    "x-sdk-source-sha256": createHash("sha256").update(canonicalSource).digest("hex"),
    "x-sdk-namespaces": [...new Set(operations.map((operation) => operation.namespace))].sort(),
    "x-sdk-operations": operations,
  });
}

async function main() {
  const document = JSON.parse(await readFile(sourceUrl, "utf8"));
  const output = `${JSON.stringify(buildSdkContract(document), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(outputUrl, "utf8").catch(() => "");
    if (current !== output) {
      console.error(`${fileURLToPath(outputUrl)} is stale; run npm run sdk:generate`);
      process.exitCode = 1;
    }
    return;
  }
  await writeFile(outputUrl, output);
  console.log(`Generated ${fileURLToPath(outputUrl)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
