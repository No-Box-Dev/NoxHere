#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
  DEFAULT_API_BASE,
  normalizedSession,
  openBrowser,
  pollLogin,
  revokeSession,
  sleep,
  startLogin,
} from "./lib/auth.mjs";
import {
  apiRequest,
  organizationLogins,
  projectCapabilityPath,
  projectsFromPayload,
  resolveProject,
  selectContext,
} from "./lib/client.mjs";
import { deleteSession, readSession, sessionLocation, withSessionLock, writeSession } from "./lib/store.mjs";
import { CLI_COMMANDS, commandHelpLines } from "./lib/commands.mjs";

const [command = "help", ...args] = process.argv.slice(2);
const apiBase = process.env.NOXCONNECT_API_BASE || process.env.NOXHERE_API_BASE || DEFAULT_API_BASE;

async function requireSession() {
  const session = await readSession();
  if (!session) throw new Error("You are not signed in. Run `noxconnect login`.");
  return session;
}

function authenticatedRequest(session, path, options = {}) {
  return apiRequest(session, path, {
    ...options,
    save: writeSession,
    load: readSession,
    withRefreshLock: (refresh) => withSessionLock("session", refresh),
  });
}

async function login() {
  return withSessionLock("session", async () => {
    const options = parseArgs({ args, options: { "no-open": { type: "boolean" } } }).values;
    const current = await readSession();
    if (current?.refreshToken) {
      console.log(`Already signed in as ${current.user?.login || "a NoxConnect user"}. Use \`noxconnect logout\` first to change accounts.`);
      return;
    }
  const started = await startLogin({ baseURL: apiBase });
  console.log(`Open ${started.verification_uri}`);
  console.log(`Enter code: ${started.user_code}`);
  if (!options["no-open"]) {
    try { await openBrowser(started.verification_uri); }
    catch { /* The printed URL remains the fallback. */ }
  }
  let interval = Math.max(5, Number(started.interval) || 5);
  const deadline = Date.now() + Math.max(60, Number(started.expires_in) || 900) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    try {
      const result = await pollLogin(started.device_code, { baseURL: apiBase });
      let session = normalizedSession(result, { apiBase });
      const organizations = organizationLogins(session);
      if (organizations.length === 1) session = selectContext(session, organizations[0]);
      await writeSession(session);
      console.log(`Signed in as ${session.user?.login || "NoxConnect user"}.`);
      if (organizations.length === 1) console.log(`Using organization ${organizations[0]}.`);
      else console.log("Choose a context with `noxconnect use <organization>/<project>`.");
      return;
    } catch (error) {
      if (error.code === "authorization_pending") continue;
      if (error.code === "slow_down" || error.status === 429) {
        interval = Math.max(interval + 5, error.retryAfter || 0);
        continue;
      }
      throw error;
    }
  }
    throw new Error("The sign-in code expired. Run `noxconnect login` again.");
  }, { timeoutMs: 20 * 60_000 });
}

async function logout() {
  return withSessionLock("session", async () => {
    const session = await readSession();
    if (!session) {
      console.log("Already signed out.");
      return;
    }
    try {
      if (session.refreshToken) await revokeSession(session.refreshToken, { baseURL: session.apiBase || apiBase });
    } finally {
      await deleteSession();
    }
    console.log("Signed out on this computer for every local NoxConnect process.");
  });
}

async function whoami() {
  const session = await requireSession();
  console.log(session.user?.login || "NoxConnect user");
  console.log(`Organization: ${session.context?.organization || "not selected"}`);
  console.log(`Project: ${session.context?.project || "all projects"}`);
  console.log(`Organizations: ${organizationLogins(session).join(", ") || "none"}`);
}

async function useContext() {
  const selection = args[0];
  const [organization, ...projectParts] = (selection || "").split("/").filter(Boolean);
  let session = selectContext(await requireSession(), organization || "");
  if (projectParts.length) {
    const reference = projectParts.join("/");
    const result = await authenticatedRequest(session, "/api/v1/projects");
    const project = resolveProject(projectsFromPayload(result.payload), reference);
    if (!project) throw new Error(`Project '${reference}' is not available in ${session.context.organization}.`);
    session = {
      ...result.session,
      context: { organization: session.context.organization, project: project.id },
    };
    await writeSession(session);
    console.log(`Using ${session.context.organization}/${project.name || project.slug || project.id}.`);
    return;
  }
  await writeSession(session);
  console.log(`Using ${session.context.organization} (all projects).`);
}

async function projects() {
  const session = await requireSession();
  const { payload } = await authenticatedRequest(session, "/api/v1/projects");
  for (const project of projectsFromPayload(payload)) console.log(`${project.name || project.slug || project.id}\t${project.id}`);
}

async function api() {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      method: { type: "string", short: "X", default: "GET" },
      data: { type: "string", short: "d" },
    },
  });
  const path = parsed.positionals[0];
  if (!path?.startsWith("/api/")) throw new Error("Usage: noxconnect api /api/v1/... [-X METHOD] [-d JSON]");
  const body = parsed.values.data === undefined ? undefined : JSON.parse(parsed.values.data);
  const session = await requireSession();
  const { payload } = await authenticatedRequest(session, path, {
    method: parsed.values.method,
    body,
  });
  if (payload !== null) console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

async function capability(name) {
  const session = await requireSession();
  const { payload } = await authenticatedRequest(session, projectCapabilityPath(session, name));
  if (payload !== null) console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

async function incidents() {
  if (args.length === 0) return capability("incidents");
  const [action, incidentId, ...extra] = args;
  const statuses = { resolve: "resolved", acknowledge: "acknowledged", reopen: "open" };
  const status = statuses[action];
  if (!status || !incidentId || extra.length) {
    throw new Error("Usage: noxconnect incidents [resolve|acknowledge|reopen] [incident-id]");
  }
  if (!/^inc_[a-f0-9]{32}$/.test(incidentId)) throw new Error("Incident IDs look like inc_<32 lowercase hex characters>.");
  const session = await requireSession();
  const path = `${projectCapabilityPath(session, "incidents")}/${encodeURIComponent(incidentId)}`;
  const { payload } = await authenticatedRequest(session, path, { method: "PATCH", body: { status } });
  console.log(JSON.stringify(payload, null, 2));
}

function help() {
  console.log(`noxconnect — one login for every NoxConnect organization, project, and capability

Commands:
${commandHelpLines().map((line) => `  ${line}`).join("\n")}

Environment:
  NOXCONNECT_API_BASE          API origin (default: ${DEFAULT_API_BASE})
  NOXCONNECT_CONFIG_HOME       Override the fallback configuration directory
  NOXCONNECT_CREDENTIAL_STORE  Set to "file" to bypass the OS credential store

Session: ${sessionLocation()}`);
}

try {
  const handlers = {
    login,
    logout,
    whoami,
    use: useContext,
    projects,
    activity: () => capability("activity"),
    incidents,
    issues: () => capability("issues"),
    feedback: () => capability("feedback"),
    api,
    help,
  };
  const missingHandlers = CLI_COMMANDS.filter(({ name }) => typeof handlers[name] !== "function");
  const undocumentedHandlers = Object.keys(handlers).filter((name) => !CLI_COMMANDS.some((commandInfo) => commandInfo.name === name));
  if (missingHandlers.length || undocumentedHandlers.length) {
    throw new Error("CLI command catalog and handlers are out of sync.");
  }
  const selected = command === "--help" || command === "-h" ? "help" : command;
  const handler = handlers[selected];
  if (!handler) throw new Error(`Unknown command '${command}'. Run \`noxconnect help\`.`);
  await handler();
} catch (error) {
  console.error(`noxconnect: ${error.message}`);
  process.exitCode = 1;
}
