import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const retiredTerms = ["noxcue", "noxspot", "noxticket", String.raw`\bcue_`, "noxfeed"];
const retiredPattern = new RegExp(retiredTerms.join("|"), "ig");
const excludedFiles = new Set([
  "docs/LEGACY_COMPATIBILITY.md",
  "scripts/check-legacy-product-names.mjs",
  "scripts/check-legacy-product-names.test.js",
]);
const installedClientFiles = new Set([
  "functions/lib/__tests__/connection-identity.test.ts",
  "packages/contracts/__tests__/native-clients.test.ts",
  "packages/contracts/native-clients.ts",
  "packages/python-sdk/src/noxhere/models.py",
  "packages/sdk-contract/public-api.json",
  "packages/sdk/src/schema.generated.ts",
  "public/openapi.json",
  "scripts/smoke-deployment.mjs",
  "services/gateway/src/control/native.test.ts",
]);

function isHistoricalMigration(file) {
  return file.split("/").includes("migrations");
}

function allowedInstalledClientReference(file, line, matches) {
  if (!installedClientFiles.has(file)) return false;
  if (matches.some((match) => match.toLowerCase() !== "noxfeed")) return false;
  return /noxfeed-mac|installed legacy noxfeed macos client|installed noxfeed app store build/i.test(line);
}

export function findLegacyProductNameViolations(files, readText) {
  const violations = [];
  for (const file of files) {
    if (excludedFiles.has(file) || isHistoricalMigration(file)) continue;
    retiredPattern.lastIndex = 0;
    if (retiredPattern.test(file)) violations.push(`${file}: legacy product name in path`);
    const text = readText(file);
    if (text.includes("\0")) continue;
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      retiredPattern.lastIndex = 0;
      const matches = [...line.matchAll(retiredPattern)].map(([match]) => match);
      if (matches.length === 0 || allowedInstalledClientReference(file, line, matches)) continue;
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  }
  return violations;
}

export function checkRepository(root = process.cwd()) {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  return findLegacyProductNameViolations(files, (file) => readFileSync(new URL(file, pathToFileURL(`${root}/`)), "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = checkRepository();
  if (violations.length > 0) {
    console.error("Active legacy product names are not allowed:\n");
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Legacy product-name boundary verified.");
  }
}
