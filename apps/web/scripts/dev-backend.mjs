import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../../..");
const ticket = path.join(backend, "services/ticket");
const persistence = path.join(backend, ".wrangler/state");
const ticketServiceName = "noxticket-web-dev";
const runner = path.join(backend, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

for (const [cwd, args] of [
  [backend, ["d1", "migrations", "apply", "noxconnect", "--local", "--persist-to", persistence]],
  [ticket, ["d1", "migrations", "apply", "DB", "--local", "--persist-to", persistence]],
]) {
  const result = spawnSync(runner, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Same knob the Vite dev harness reads, so the seeded org and the signed
// identity can never drift apart.
const orgId = Number(process.env.NOX_DEV_ORG_ID ?? 2);
if (!Number.isInteger(orgId) || orgId <= 0) {
  console.error(`NOX_DEV_ORG_ID must be a positive integer, received ${JSON.stringify(process.env.NOX_DEV_ORG_ID)}`);
  process.exit(1);
}

const catalog = spawnSync(runner, ["d1", "execute", "noxconnect", "--local", "--command", `SELECT COUNT(*) AS count FROM projects WHERE org_id = ${orgId} AND archived = 0`, "--json"], {
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

const ticketServer = spawn(runner, [
  "dev", "--name", ticketServiceName, "--port", "8795", "--inspector-port", "9235",
  "--local", "--persist-to", persistence, "--show-interactive-dev-session=false",
], { cwd: ticket, stdio: "inherit", env: process.env });

const ticketReadyBy = Date.now() + 30_000;
while (Date.now() < ticketReadyBy) {
  if (ticketServer.exitCode !== null) process.exit(ticketServer.exitCode ?? 1);
  try {
    const response = await fetch("http://127.0.0.1:8795/health");
    if (response.ok) break;
  } catch { /* wait for the local service registry */ }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (Date.now() >= ticketReadyBy) {
  ticketServer.kill("SIGTERM");
  throw new Error("Local NoxTicket service did not become ready");
}

const server = spawn(runner, [
  "pages", "dev", "dist", "--port", "8788",
  "--persist-to", persistence,
  "--binding", "NOXHERE_INTERNAL_SECRET=noxhere-local-development-only-secret",
  "--service", `NOXTICKET_SERVICE=${ticketServiceName}`,
], { cwd: backend, stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  ticketServer.kill(signal);
  server.kill(signal);
});
ticketServer.on("exit", (code) => {
  if (server.exitCode === null) server.kill("SIGTERM");
  process.exit(code ?? 0);
});
server.on("exit", (code) => {
  if (ticketServer.exitCode === null) ticketServer.kill("SIGTERM");
  process.exit(code ?? 0);
});
