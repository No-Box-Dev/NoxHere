import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const KEYCHAIN_SERVICE = "com.noxconnect.cli";
const LEGACY_KEYCHAIN_ACCOUNT = "session";
const DEFAULT_API_BASE = "https://app.noxhere.com";

function apiOrigin(env = process.env) {
  const value = env.NOXCONNECT_API_BASE || env.NOXHERE_API_BASE || DEFAULT_API_BASE;
  try { return new URL(value).origin.toLowerCase(); }
  catch { return value.toLowerCase(); }
}

function originKey(env = process.env) {
  return createHash("sha256").update(apiOrigin(env)).digest("hex").slice(0, 16);
}

function keychainAccount(env = process.env) {
  return `session:${apiOrigin(env)}`;
}

function explicitFileStore(env = process.env) {
  return env.NOXCONNECT_CREDENTIAL_STORE === "file";
}

export function sessionPath(env = process.env) {
  const configHome = env.NOXCONNECT_CONFIG_HOME
    || env.XDG_CONFIG_HOME
    || join(homedir(), ".config");
  return join(configHome, "noxconnect", "session.json");
}

export function useMacKeychain(env = process.env, platformName = platform()) {
  return platformName === "darwin" && !explicitFileStore(env);
}

async function readKeychainAccount(account) {
  try {
    const { stdout } = await execute("security", [
      "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w",
    ], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } catch (error) {
    if (error?.code === 44 || error?.stderr?.includes("could not be found")) return null;
    throw new Error(`Could not read the NoxConnect session from Keychain: ${error.message}`);
  }
}

async function writeKeychainAccount(value, account) {
  await execute("security", [
    "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", account,
    "-w", JSON.stringify(value),
  ], { encoding: "utf8", maxBuffer: 1024 * 1024 });
}

async function deleteKeychainAccount(account) {
  try {
    await execute("security", ["delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account]);
  } catch (error) {
    if (error?.code !== 44 && !error?.stderr?.includes("could not be found")) throw error;
  }
}

async function readKeychain(env = process.env) {
  const account = keychainAccount(env);
  const current = await readKeychainAccount(account);
  if (current) return current;
  const legacy = await readKeychainAccount(LEGACY_KEYCHAIN_ACCOUNT);
  if (!legacy) return null;
  const legacyOrigin = (() => {
    try { return new URL(legacy.apiBase || DEFAULT_API_BASE).origin.toLowerCase(); }
    catch { return DEFAULT_API_BASE; }
  })();
  if (legacyOrigin !== apiOrigin(env)) return null;
  await writeKeychainAccount(legacy, account);
  await deleteKeychainAccount(LEGACY_KEYCHAIN_ACCOUNT);
  return legacy;
}

async function writeKeychain(value, env = process.env) {
  return writeKeychainAccount(value, keychainAccount(env));
}

async function deleteKeychain(env = process.env) {
  return deleteKeychainAccount(keychainAccount(env));
}

function secretToolUnavailable(error) {
  return error?.code === "ENOENT"
    || /cannot autolaunch d-bus|no such secret collection|serviceunknown/i.test(String(error?.stderr || error?.message || ""));
}

async function readLinuxSecretService(env = process.env) {
  try {
    const { stdout } = await execute("secret-tool", [
      "lookup", "service", KEYCHAIN_SERVICE, "account", keychainAccount(env),
    ], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    return { available: true, value: stdout.trim() ? JSON.parse(stdout.trim()) : null };
  } catch (error) {
    if (error?.code === 1) return { available: true, value: null };
    if (secretToolUnavailable(error)) return { available: false, value: null };
    throw new Error(`Could not read the NoxConnect session from Linux Secret Service: ${error.message}`);
  }
}

async function writeLinuxSecretService(value, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn("secret-tool", [
      "store", "--label=NoxConnect CLI session", "service", KEYCHAIN_SERVICE,
      "account", keychainAccount(env),
    ], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (secretToolUnavailable(error)) resolve(false);
      else reject(new Error(`Could not write the NoxConnect session to Linux Secret Service: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) resolve(true);
      else if (secretToolUnavailable({ message: stderr, stderr })) resolve(false);
      else reject(new Error(`Could not write the NoxConnect session to Linux Secret Service: ${stderr.trim() || `exit ${code}`}`));
    });
    child.stdin.end(JSON.stringify(value));
  });
}

async function deleteLinuxSecretService(env = process.env) {
  try {
    await execute("secret-tool", ["clear", "service", KEYCHAIN_SERVICE, "account", keychainAccount(env)]);
    return true;
  } catch (error) {
    if (error?.code === 1) return true;
    if (secretToolUnavailable(error)) return false;
    throw error;
  }
}

function windowsDpapiPath(env = process.env) {
  return `${sharedSessionPath(env)}.dpapi`;
}

async function readWindowsDpapi(env = process.env) {
  const path = windowsDpapiPath(env);
  const script = "$p=$args[0];if(!(Test-Path -LiteralPath $p)){exit 44};$e=[IO.File]::ReadAllBytes($p);$d=[Security.Cryptography.ProtectedData]::Unprotect($e,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Convert]::ToBase64String($d)";
  try {
    const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script, path], { encoding: "utf8" });
    return JSON.parse(Buffer.from(stdout.trim(), "base64").toString("utf8"));
  } catch (error) {
    if (error?.code === 44) return null;
    throw new Error(`Could not read the NoxConnect session protected by Windows: ${error.message}`);
  }
}

async function writeWindowsDpapi(value, env = process.env) {
  const path = windowsDpapiPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  const script = "$p=$args[0];$d=[Convert]::FromBase64String($args[1]);$e=[Security.Cryptography.ProtectedData]::Protect($d,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes($p,$e)";
  await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script, path, encoded], { encoding: "utf8" });
}

function sharedStateHome(env = process.env) {
  if (platform() === "win32") return env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  return env.XDG_STATE_HOME || join(homedir(), ".local", "state");
}

export function sharedSessionPath(env = process.env) {
  return join(sharedStateHome(env), "noxconnect", `session-${originKey(env)}.json`);
}

async function readFileSession(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Could not read ${path}: ${error.message}`);
  }
}

async function writeFileSession(value, path) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function migrateLegacyFileSession(paths, write) {
  for (const path of new Set(paths)) {
    const legacy = await readFileSession(path);
    if (!legacy || typeof legacy.refreshToken !== "string" || !legacy.refreshToken.startsWith("nox_rt_")) continue;
    await write(legacy);
    await unlink(path).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    return legacy;
  }
  return null;
}

export async function readSession(path) {
  if (path === undefined && useMacKeychain()) {
    const current = await readKeychain();
    return current || migrateLegacyFileSession([sessionPath()], writeKeychain);
  }
  if (path === undefined && platform() === "linux" && !explicitFileStore()) {
    const secret = await readLinuxSecretService();
    if (secret.available) {
      return secret.value || migrateLegacyFileSession(
        [sharedSessionPath(), sessionPath()],
        async (legacy) => {
          if (!(await writeLinuxSecretService(legacy))) throw new Error("Linux Secret Service became unavailable during credential migration.");
        },
      );
    }
  }
  if (path === undefined && platform() === "win32" && !explicitFileStore()) {
    const current = await readWindowsDpapi();
    return current || migrateLegacyFileSession([sharedSessionPath(), sessionPath()], writeWindowsDpapi);
  }
  if (path !== undefined || explicitFileStore()) {
    return readFileSession(path || sessionPath());
  }
  const sharedPath = sharedSessionPath();
  const current = await readFileSession(sharedPath);
  if (current) return current;
  const legacyPath = sessionPath();
  const legacy = await readFileSession(legacyPath);
  if (!legacy) return null;
  await writeFileSession(legacy, sharedPath);
  await unlink(legacyPath).catch((error) => { if (error?.code !== "ENOENT") throw error; });
  return legacy;
}

export async function writeSession(value, path) {
  if (path === undefined && useMacKeychain()) return writeKeychain(value);
  if (path === undefined && platform() === "linux" && !explicitFileStore()) {
    if (await writeLinuxSecretService(value)) return;
  }
  if (path === undefined && platform() === "win32" && !explicitFileStore()) return writeWindowsDpapi(value);
  const target = path || (explicitFileStore() ? sessionPath() : sharedSessionPath());
  return writeFileSession(value, target);
}

export async function deleteSession(path) {
  if (path === undefined && useMacKeychain()) return deleteKeychain();
  if (path === undefined && platform() === "linux" && !explicitFileStore()) {
    if (await deleteLinuxSecretService()) return;
  }
  if (path === undefined && platform() === "win32" && !explicitFileStore()) {
    await unlink(windowsDpapiPath()).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    return;
  }
  try {
    const target = path || (explicitFileStore() ? sessionPath() : sharedSessionPath());
    await unlink(target);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function sessionLocation(env = process.env) {
  if (useMacKeychain(env)) return `macOS Keychain (${KEYCHAIN_SERVICE}, ${apiOrigin(env)})`;
  if (!explicitFileStore(env) && platform() === "linux") return `Linux Secret Service when available; protected fallback ${sharedSessionPath(env)}`;
  if (!explicitFileStore(env) && platform() === "win32") return `Windows user-protected credential (${apiOrigin(env)})`;
  return explicitFileStore(env) ? sessionPath(env) : sharedSessionPath(env);
}

async function staleSessionLock(path, details) {
  if (Date.now() - details.mtimeMs > 20 * 60_000) return true;
  try {
    const metadata = JSON.parse(await readFile(path, "utf8"));
    if (!Number.isSafeInteger(metadata.pid) || metadata.pid <= 0 || metadata.pid === process.pid) return false;
    try { process.kill(metadata.pid, 0); return false; }
    catch (error) { return error?.code === "ESRCH"; }
  } catch { return false; }
}

export async function withSessionLock(name, task, { timeoutMs = 30_000, env = process.env } = {}) {
  const path = join(sharedStateHome(env), "noxconnect", "locks", `${originKey(env)}-${name}.lock`);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + timeoutMs;
  let handle;
  while (!handle) {
    try {
      handle = await open(path, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const details = await stat(path).catch(() => null);
      if (details && await staleSessionLock(path, details)) {
        await unlink(path).catch(() => {});
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for another NoxConnect ${name} operation.`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  try { return await task(); }
  finally {
    await handle.close();
    await unlink(path).catch(() => {});
  }
}
