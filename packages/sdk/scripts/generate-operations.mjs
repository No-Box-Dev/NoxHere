import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const packageRoot = new URL("../", import.meta.url);
const contractUrl = new URL("../../packages/sdk-contract/public-api.json", packageRoot);
const outputUrl = new URL("src/operations.generated.ts", packageRoot);
const schemaOutputUrl = new URL("src/schema.generated.ts", packageRoot);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));
const operations = contract["x-sdk-operations"].map((operation) => ({
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
const rawSchemaOutput = astToString(await openapiTS(contractUrl));
const recursiveJsonValue = `        JsonValue: null | boolean | number | string | components["schemas"]["JsonValue"][] | {\n            [key: string]: components["schemas"]["JsonValue"];\n        };`;
if (!rawSchemaOutput.includes(recursiveJsonValue)) {
  throw new Error("The generated JsonValue representation changed; update the recursion-safe SDK type transform");
}
const schemaOutput = rawSchemaOutput
  .replace("export interface paths", `export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };\n\nexport interface paths`)
  .replace(recursiveJsonValue, "        JsonValue: JsonValue;");

if (process.argv.includes("--check")) {
  const existing = await readFile(outputUrl, "utf8").catch(() => "");
  const existingSchema = await readFile(schemaOutputUrl, "utf8").catch(() => "");
  if (existing !== output || existingSchema !== schemaOutput) {
    const stale = [existing !== output ? outputUrl : null, existingSchema !== schemaOutput ? schemaOutputUrl : null]
      .filter(Boolean).map((url) => fileURLToPath(url)).join(", ");
    console.error(`${stale} is stale; run npm run generate`);
    process.exit(1);
  }
} else {
  await writeFile(outputUrl, output);
  await writeFile(schemaOutputUrl, schemaOutput);
  console.log(`Generated ${operations.length} operations in ${fileURLToPath(outputUrl)}`);
}
