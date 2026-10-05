import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = new URL("../", import.meta.url);
const openApiUrl = new URL("../../public/openapi.json", packageRoot);
const outputUrl = new URL("src/operations.generated.ts", packageRoot);
const methods = new Set(["get", "post", "put", "patch", "delete"]);
const namespaceForTag = {
  NoxConnect: "workspace",
  Activity: "activity",
  NoxTicket: "planning",
  NoxSpot: "feedback",
  NoxCue: "incidents",
};

const document = JSON.parse(await readFile(openApiUrl, "utf8"));
const operations = [];
for (const [path, pathItem] of Object.entries(document.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method) || !operation.operationId) continue;
    const tag = operation.tags?.[0];
    const namespace = namespaceForTag[tag];
    if (!namespace) throw new Error(`No SDK namespace for ${operation.operationId} tag ${tag}`);
    operations.push({ id: operation.operationId, method: method.toUpperCase(), path, namespace });
  }
}
operations.sort((left, right) => left.id.localeCompare(right.id));
const duplicates = operations.filter((item, index) => operations.findIndex((other) => other.id === item.id) !== index);
if (duplicates.length) throw new Error(`Duplicate operationIds: ${duplicates.map((item) => item.id).join(", ")}`);

const output = `// Generated from public/openapi.json. Do not edit by hand.\n` +
  `export const operationDefinitions = ${JSON.stringify(operations, null, 2)} as const;\n` +
  `export type OperationId = typeof operationDefinitions[number]["id"];\n` +
  `export type ResourceNamespace = typeof operationDefinitions[number]["namespace"];\n`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputUrl, "utf8").catch(() => "");
  if (existing !== output) {
    console.error(`${fileURLToPath(outputUrl)} is stale; run npm run generate`);
    process.exit(1);
  }
} else {
  await writeFile(outputUrl, output);
  console.log(`Generated ${operations.length} operations in ${fileURLToPath(outputUrl)}`);
}
