import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(`Retry/quarantine policy failed: ${message}`);
}

export function verifyRetryQuarantinePolicy() {
  const schedulerConfig = read("services/scheduler/wrangler.toml");
  const scheduler = read("services/scheduler/src/index.js");
  const identity = read("functions/lib/connection-identity.ts");
  const typescriptSdk = read("packages/sdk/src/client.ts");
  const pythonSdk = read("packages/python-sdk/src/noxhere/client.py");
  const migration = read("migrations/0118_task_quarantine.sql");
  const recovery = read("functions/api/op-failures.js");

  const retryCounts = [...schedulerConfig.matchAll(/max_retries\s*=\s*(\d+)/g)].map((match) => Number(match[1]));
  if (retryCounts.length !== 2 || retryCounts.some((count) => count !== 4)) {
    throw new Error("Retry/quarantine policy failed: production and staging queues must use exactly four retries");
  }
  if ((schedulerConfig.match(/dead_letter_queue\s*=/g) ?? []).length !== 2) {
    throw new Error("Retry/quarantine policy failed: production and staging queues require DLQs");
  }
  requireMatch(scheduler, /const MAX_DELIVERIES = 5;/, "consumer delivery bound must match queue retries");
  requireMatch(scheduler, /await quarantineTask\([^;]+;/, "terminal tasks must be persisted before retry");
  requireMatch(scheduler, /msg\.retry\(\);[\s\S]*?DLQ|DLQ[\s\S]*?msg\.retry\(\);/, "terminal tasks must be handed to the DLQ");
  requireMatch(identity, /Math\.min\(900, Math\.max\(60,/, "device authorization lifetime must be bounded");
  requireMatch(identity, /Math\.min\(60, Math\.max\(5,/, "device polling interval must be bounded");
  requireMatch(typescriptSdk, /const MAX_RETRIES = 5;/, "TypeScript retries must have a hard cap");
  requireMatch(pythonSdk, /min\(5, max\(0, int\(max_retries\)\)\)/, "Python retries must have a hard cap");
  requireMatch(migration, /status IN \('quarantined', 'requeuing', 'requeued'\)/, "quarantine lifecycle must be explicit");
  requireMatch(recovery, /requeueQuarantinedTask/, "admins need an actionable quarantine recovery endpoint");
  return { queueRetries: 4, maxDeliveries: 5, sdkRetryCap: 5, deviceAuthorizationMaxSeconds: 900 };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify({ status: "bounded", ...verifyRetryQuarantinePolicy() })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
