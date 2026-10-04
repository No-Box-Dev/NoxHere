#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const SKIP_SEGMENTS = new Set(["node_modules", "dist", ".git", ".generated", "__tests__"]);

const PROVIDERS = {
  slack: {
    allowed: new Set(["functions/lib/slack.js", "functions/lib/delivery-outbox.js", "functions/lib/transports/slack.ts"]),
    patterns: [
      { regex: /\b(?:postSlackMessage|updateSlackMessage)\s*\(/g, reason: "Slack message mutation helper" },
      { regex: /["']chat\.(?:postMessage|update)["']/g, reason: "Slack message mutation endpoint" },
      { regex: /\bstageSlackDelivery\s*\(/g, reason: "Legacy Slack outbox staging" },
      { regex: /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+delivery_outbox/gi, reason: "Direct legacy Slack outbox insert" },
    ],
  },
  github: {
    allowed: new Set(["functions/lib/github-issues.js", "functions/lib/transports/github.ts"]),
    patterns: [
      { regex: /\b(?:createRepositoryIssue|updateRepositoryIssue|createRepositoryIssueComment|closePullRequest)\s*\(/g, reason: "GitHub mutation helper" },
    ],
  },
};

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (SKIP_SEGMENTS.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

export async function findTransportBoundaryViolations({ root, provider, roots = ["functions", "cron/src", "workers"] }) {
  const rule = PROVIDERS[provider];
  if (!rule) throw new Error(`Unknown provider: ${provider}`);
  const violations = [];
  for (const sourceRoot of roots) {
    for (const path of await sourceFiles(resolve(root, sourceRoot))) {
      const file = relative(root, path).replaceAll("\\", "/");
      if (rule.allowed.has(file)) continue;
      const content = await readFile(path, "utf8");
      for (const pattern of rule.patterns) {
        for (const match of content.matchAll(pattern.regex)) {
          const line = content.slice(0, match.index).split("\n").length;
          violations.push({ file, line, reason: pattern.reason });
        }
      }
    }
  }
  return violations;
}

async function main() {
  const providerIndex = process.argv.indexOf("--provider");
  const provider = providerIndex >= 0 ? process.argv[providerIndex + 1] : "";
  if (!provider) throw new Error("Usage: node scripts/check-transport-boundaries.mjs --provider <slack|github>");
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const violations = await findTransportBoundaryViolations({ root, provider });
  if (violations.length > 0) {
    console.error(`${provider} transport boundary violations:`);
    for (const violation of violations) console.error(`- ${violation.file}:${violation.line} ${violation.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${provider} transport boundary: PASS`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
