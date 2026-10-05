import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseName = "noxfeed-demo-staging";
const configUrl = new URL("../services/feed/wrangler.toml", import.meta.url);
const databaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function databaseIdFromList(value, name = databaseName) {
  const databases = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(databases)) throw new Error("Wrangler returned an invalid D1 database list");
  const matches = databases.filter((database) => database?.name === name);
  if (matches.length > 1) throw new Error(`Multiple D1 databases are named ${name}`);
  const id = matches[0]?.uuid ?? matches[0]?.id ?? null;
  return typeof id === "string" && databaseIdPattern.test(id) ? id : null;
}

export function configureStagingDatabase(config, id, name = databaseName) {
  if (!databaseIdPattern.test(id)) throw new Error(`Invalid D1 database id: ${id}`);
  const environmentStart = config.indexOf("[env.staging]");
  if (environmentStart < 0) throw new Error("Feed Wrangler config has no staging environment");
  const databaseStart = config.indexOf("[[env.staging.d1_databases]]", environmentStart);
  if (databaseStart < 0) throw new Error("Feed staging environment has no D1 binding");
  const nextSection = config.indexOf("\n[", databaseStart + 1);
  const sectionEnd = nextSection < 0 ? config.length : nextSection;
  const section = config.slice(databaseStart, sectionEnd);
  if (!section.includes('binding = "DEMO_DB"')) throw new Error("Feed staging D1 binding is not DEMO_DB");
  const configured = section
    .replace(/^database_name\s*=.*$/m, `database_name = "${name}"`)
    .replace(/^database_id\s*=.*$/m, `database_id = "${id}"`);
  if (!configured.includes(`database_id = "${id}"`)) {
    throw new Error("Could not update the Feed staging D1 binding");
  }
  return `${config.slice(0, databaseStart)}${configured}${config.slice(sectionEnd)}`;
}

function runWrangler(args, stdio = "pipe") {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: process.env,
    stdio,
  });
  if (result.status !== 0) {
    const detail = stdio === "pipe" ? result.stderr || result.stdout : "";
    throw new Error(`wrangler ${args.join(" ")} failed${detail ? `: ${detail.trim()}` : ""}`);
  }
  return result.stdout ?? "";
}

function listDatabases() {
  return databaseIdFromList(runWrangler(["d1", "list", "--json"]));
}

export async function main() {
  let id = listDatabases();
  if (!id) {
    console.log(`Creating dedicated staging D1 database ${databaseName}...`);
    runWrangler(["d1", "create", databaseName], "inherit");
    id = listDatabases();
  }
  if (!id) throw new Error(`Could not resolve D1 database ${databaseName} after creation`);

  const config = await readFile(configUrl, "utf8");
  await writeFile(configUrl, configureStagingDatabase(config, id), "utf8");
  console.log(`Configured ${databaseName} (${id}) for this staging deployment.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
