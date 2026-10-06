import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = new URL("../", import.meta.url);
const contractUrl = new URL("../../packages/sdk-contract/public-api.json", packageRoot);
const outputUrl = new URL("src/operations.generated.ts", packageRoot);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));
const operations = contract.operations.map((operation) => ({
  id: operation.id,
  method: operation.method,
  path: operation.path,
  namespace: operation.namespace,
  authentication: operation.authentication,
  automationScope: operation.automationScope,
  projectScope: operation.projectScope,
  changeSafety: operation.changeSafety,
  requestContentTypes: operation.requestContentTypes,
  responseContentTypes: operation.responseContentTypes,
}));

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
