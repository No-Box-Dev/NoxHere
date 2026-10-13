#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const [config, environment, ...requiredNames] = process.argv.slice(2);

if (!config || !environment || requiredNames.length === 0) {
  console.error("Usage: check-worker-secrets.mjs <config> <environment|default> <secret> [...secret]");
  process.exit(2);
}

const wranglerArgs = ["wrangler", "secret", "list", "--config", config, "--format", "json"];
if (environment !== "default") wranglerArgs.push("--env", environment);

const result = spawnSync("npx", wranglerArgs, {
  encoding: "utf8",
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

let configured;
try {
  const parsed = JSON.parse(result.stdout);
  configured = new Set(parsed.map((entry) => entry.name));
} catch {
  console.error("Could not parse the Worker secret inventory returned by Wrangler.");
  process.exit(1);
}

const missing = requiredNames.filter((name) => !configured.has(name));
const worker = environment === "default" ? config : `${config} (${environment})`;
if (missing.length > 0) {
  console.error(`Missing required Worker secrets for ${worker}: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Verified ${requiredNames.length} required Worker secret names for ${worker}.`);
