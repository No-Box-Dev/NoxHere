import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../../../noxconnect");
const runner = process.platform === "win32" ? "npx.cmd" : "npx";

for (const args of [
  ["wrangler", "d1", "migrations", "apply", "noxconnect", "--local"],
]) {
  const result = spawnSync(runner, args, { cwd: backend, stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Same knob the Vite dev harness reads, so the seeded org and the signed
// identity can never drift apart.
const orgId = Number(process.env.NOX_DEV_ORG_ID ?? 2);
if (!Number.isInteger(orgId) || orgId <= 0) {
  console.error(`NOX_DEV_ORG_ID must be a positive integer, received ${JSON.stringify(process.env.NOX_DEV_ORG_ID)}`);
  process.exit(1);
}

const catalog = spawnSync(runner, ["wrangler", "d1", "execute", "noxconnect", "--local", "--command", `SELECT COUNT(*) AS count FROM projects WHERE org_id = ${orgId} AND archived = 0`, "--json"], {
  cwd: backend,
  encoding: "utf8",
  env: process.env,
});
if (catalog.status !== 0) {
  process.stderr.write(catalog.stderr);
  process.exit(catalog.status ?? 1);
}
const projectCount = Number(JSON.parse(catalog.stdout)[0]?.results?.[0]?.count ?? 0);
if (projectCount === 0) {
  const sync = spawnSync(process.execPath, ["scripts/sync-noxhere-projects-local.mjs", String(orgId)], {
    cwd: backend,
    stdio: "inherit",
    env: process.env,
  });
  if (sync.status !== 0) process.exit(sync.status ?? 1);
} else {
  console.log(`Using ${projectCount} projects already present in local NoxConnect for org ${orgId}.`);
}

const server = spawn(runner, [
  "wrangler", "pages", "dev", "dist", "--port", "8788",
  "--binding", "NOXHERE_INTERNAL_SECRET=noxhere-local-development-only-secret",
  "--binding", "NOXHERE_LOCAL_MONOLITH=1",
], { cwd: backend, stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
