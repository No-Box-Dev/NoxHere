import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(root, "packages/contracts/platform-events.ts");
const tsOutput = path.join(root, "packages/sdk/src/events.generated.ts");
const pythonOutput = path.join(root, "packages/python-sdk/src/noxhere/_events.py");
const check = process.argv.includes("--check");

const source = await readFile(sourcePath, "utf8");

function integer(name) {
  const match = source.match(new RegExp(`export const ${name} = ([\\d_]+)`));
  if (!match) throw new Error(`Could not read ${name} from ${sourcePath}`);
  return Number(match[1].replaceAll("_", ""));
}

const eventTypes = [...source.matchAll(/event\("([a-z0-9_.]+)"\s*,/g)].map((match) => match[1]);
if (eventTypes.length === 0 || new Set(eventTypes).size !== eventTypes.length) {
  throw new Error("Canonical platform event types must be present and unique");
}

const forbiddenBlock = source.match(/const FORBIDDEN_EVENT_KEYS = new Set\(\[([\s\S]*?)\]\);/);
if (!forbiddenBlock) throw new Error("Could not read FORBIDDEN_EVENT_KEYS from canonical platform event contract");
const forbiddenKeys = [...forbiddenBlock[1].matchAll(/"([a-z0-9]+)"/g)].map((match) => match[1]);

const contract = {
  specVersion: integer("PLATFORM_EVENT_SPEC_VERSION"),
  dataVersion: integer("PLATFORM_EVENT_DATA_VERSION"),
  maxBytes: integer("MAX_PLATFORM_EVENT_BYTES"),
  eventTypes,
  forbiddenKeys,
};

const tsSource = `// Generated from packages/contracts/platform-events.ts. Do not edit by hand.\n\nexport const PLATFORM_EVENT_SPEC_VERSION = ${contract.specVersion} as const;\nexport const PLATFORM_EVENT_DATA_VERSION = ${contract.dataVersion} as const;\nexport const MAX_PLATFORM_EVENT_BYTES = ${contract.maxBytes} as const;\nexport const PLATFORM_EVENT_TYPES = ${JSON.stringify(contract.eventTypes)} as const;\nexport const FORBIDDEN_PLATFORM_EVENT_KEYS = ${JSON.stringify(contract.forbiddenKeys)} as const;\n`;
const pythonTuple = (values) => `(${values.map((value) => JSON.stringify(value)).join(", ")},)`;
const pythonSource = `# Generated from packages/contracts/platform-events.ts. Do not edit by hand.\n\nPLATFORM_EVENT_SPEC_VERSION = ${contract.specVersion}\nPLATFORM_EVENT_DATA_VERSION = ${contract.dataVersion}\nMAX_PLATFORM_EVENT_BYTES = ${contract.maxBytes}\nPLATFORM_EVENT_TYPES = ${pythonTuple(contract.eventTypes)}\nFORBIDDEN_PLATFORM_EVENT_KEYS = ${pythonTuple(contract.forbiddenKeys)}\n`;

async function emit(output, expected) {
  if (check) {
    const actual = await readFile(output, "utf8").catch(() => "");
    if (actual !== expected) throw new Error(`${path.relative(root, output)} is stale; run npm run sdk:generate`);
    return;
  }
  await writeFile(output, expected);
}

await Promise.all([emit(tsOutput, tsSource), emit(pythonOutput, pythonSource)]);
