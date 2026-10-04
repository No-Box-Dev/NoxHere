import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deleteSession, readSession, sessionPath, sharedSessionPath, useMacKeychain, withSessionLock, writeSession } from "../lib/store.mjs";

test("the explicit file fallback stays private and round-trips the session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "noxconnect-cli-"));
  const path = join(directory, "session.json");
  const session = { refreshToken: "nox_rt_secret", context: { organization: "Acme" } };
  await writeSession(session, path);
  assert.deepEqual(await readSession(path), session);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.doesNotMatch(await readFile(path, "utf8"), /noxhere/i);
  await deleteSession(path);
  assert.equal(await readSession(path), null);
});

test("macOS Keychain remains active across agent-specific config homes", () => {
  const envA = { NOXCONNECT_CONFIG_HOME: "/tmp/agent-a" };
  const envB = { NOXCONNECT_CONFIG_HOME: "/tmp/agent-b" };
  assert.equal(useMacKeychain(envA, "darwin"), true);
  assert.equal(useMacKeychain(envB, "darwin"), true);
  assert.equal(useMacKeychain({ ...envA, NOXCONNECT_CREDENTIAL_STORE: "file" }, "darwin"), false);
  assert.notEqual(sessionPath(envA), sessionPath(envB));
});

test("automatic file fallback is shared across config homes and separated by API origin", () => {
  const common = { XDG_STATE_HOME: "/tmp/noxconnect-state" };
  assert.equal(
    sharedSessionPath({ ...common, NOXCONNECT_CONFIG_HOME: "/tmp/agent-a" }),
    sharedSessionPath({ ...common, NOXCONNECT_CONFIG_HOME: "/tmp/agent-b" }),
  );
  assert.notEqual(
    sharedSessionPath({ ...common, NOXCONNECT_API_BASE: "https://app.noxhere.com" }),
    sharedSessionPath({ ...common, NOXCONNECT_API_BASE: "https://staging.noxhere.com" }),
  );
});

test("session locks serialize concurrent local agents", async () => {
  const state = await mkdtemp(join(tmpdir(), "noxconnect-locks-"));
  const env = { XDG_STATE_HOME: state, NOXCONNECT_API_BASE: "https://locks.example" };
  const order = [];
  let entered;
  const firstEntered = new Promise((resolve) => { entered = resolve; });
  const first = withSessionLock("session", async () => {
    order.push("first:start");
    entered();
    await new Promise((resolve) => setTimeout(resolve, 30));
    order.push("first:end");
  }, { env });
  await firstEntered;
  const second = withSessionLock("session", async () => { order.push("second"); }, { env });
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first:start", "first:end", "second"]);
});
