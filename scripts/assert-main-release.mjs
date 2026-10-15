import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fail(message) {
  console.error(`Production deployment refused: ${message}`);
  console.error("Production releases are created automatically after CI succeeds on the current main commit.");
  process.exit(1);
}

if (process.env.GITHUB_ACTIONS !== "true") {
  fail("local production deploys are disabled");
}

if (!new Set(["workflow_run", "push"]).has(process.env.GITHUB_EVENT_NAME)) {
  fail(`unsupported GitHub event ${process.env.GITHUB_EVENT_NAME || "(missing)"}`);
}

const deploySha = process.env.DEPLOY_SHA;
if (!/^[0-9a-f]{40}$/.test(deploySha ?? "")) {
  fail("DEPLOY_SHA must be the full commit SHA selected by the release workflow");
}

try {
  git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main");
  const checkedOutSha = git("rev-parse", "HEAD");
  const currentMainSha = git("rev-parse", "refs/remotes/origin/main");
  const trackedChanges = git("status", "--porcelain", "--untracked-files=no");

  if (checkedOutSha !== deploySha) fail(`checked-out commit ${checkedOutSha} does not match DEPLOY_SHA ${deploySha}`);
  if (currentMainSha !== deploySha) fail(`release ${deploySha} is stale; current main is ${currentMainSha}`);
  if (trackedChanges) fail("the release checkout contains modified tracked files");
} catch (error) {
  if (typeof error?.status === "number" && error.status === 1) process.exit(1);
  fail(error instanceof Error ? error.message : String(error));
}

console.log(`Production source verified: current main ${deploySha}`);
