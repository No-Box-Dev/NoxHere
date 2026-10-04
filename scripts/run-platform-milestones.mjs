import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { activeMilestone, milestones } from "./platform-milestones.config.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export class MilestoneFailure extends Error {
  constructor(milestoneId, gateName, reason) {
    super(`${milestoneId} blocked at “${gateName}”: ${reason}`);
    this.name = "MilestoneFailure";
    this.milestoneId = milestoneId;
    this.gateName = gateName;
  }
}

export function validateManifest(manifest, activeId) {
  if (!Array.isArray(manifest) || manifest.length === 0) throw new Error("Milestone manifest is empty");
  const ids = new Set();
  for (const [index, milestone] of manifest.entries()) {
    if (!/^M\d+$/.test(milestone.id)) throw new Error(`Invalid milestone id at index ${index}`);
    if (ids.has(milestone.id)) throw new Error(`Duplicate milestone id: ${milestone.id}`);
    if (milestone.id !== `M${index}`) {
      throw new Error(`Milestones must be sequential: expected M${index}, received ${milestone.id}`);
    }
    ids.add(milestone.id);
    if (!milestone.name || !milestone.objective) throw new Error(`${milestone.id} is missing its name or objective`);
    if (!Array.isArray(milestone.requiredPaths) || !Array.isArray(milestone.gates) || milestone.gates.length === 0) {
      throw new Error(`${milestone.id} must declare requiredPaths and at least one gate`);
    }
    for (const gate of milestone.gates) {
      if (!gate.name || !gate.command || !Array.isArray(gate.args)) {
        throw new Error(`${milestone.id} contains an invalid gate`);
      }
    }
  }
  if (!ids.has(activeId)) throw new Error(`Active milestone does not exist: ${activeId}`);
}

export function milestonesThrough(manifest, targetId) {
  const index = manifest.findIndex(({ id }) => id === targetId);
  if (index < 0) throw new Error(`Unknown milestone: ${targetId}`);
  return manifest.slice(0, index + 1);
}

function expandArg(value, tempDir) {
  return value.replaceAll("{tempDir}", tempDir);
}

function executeGate(gate, { root, tempDir }) {
  const args = gate.args.map((argument) => expandArg(argument, tempDir));
  const result = spawnSync(gate.command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) return { ok: false, reason: result.error.message };
  if (result.signal) return { ok: false, reason: `terminated by ${result.signal}` };
  return result.status === 0
    ? { ok: true }
    : { ok: false, reason: `command exited with status ${result.status ?? "unknown"}` };
}

export function runMilestones(plan, options = {}) {
  const root = options.root ?? repositoryRoot;
  const runGate = options.runGate ?? executeGate;
  const write = options.write ?? ((message) => process.stdout.write(`${message}\n`));
  const makeTempDir = options.makeTempDir ?? (() => mkdtempSync(join(tmpdir(), "nox-platform-milestones-")));
  const removeTempDir = options.removeTempDir ?? ((path) => rmSync(path, { recursive: true, force: true }));

  for (const milestone of plan) {
    write(`\n[${milestone.id}] ${milestone.name}`);
    write(`Objective: ${milestone.objective}`);

    for (const requiredPath of milestone.requiredPaths) {
      if (!existsSync(resolve(root, requiredPath))) {
        throw new MilestoneFailure(milestone.id, "setup", `required path is missing: ${requiredPath}`);
      }
    }
    write(`✓ setup (${milestone.requiredPaths.length} required paths)`);

    const tempDir = makeTempDir();
    try {
      for (const gate of milestone.gates) {
        write(`→ ${gate.name}`);
        const result = runGate(gate, { root, tempDir, milestone });
        if (!result?.ok) {
          throw new MilestoneFailure(milestone.id, gate.name, result?.reason ?? "gate failed");
        }
        write(`✓ ${gate.name}`);
      }
    } finally {
      removeTempDir(tempDir);
    }
    write(`✓ ${milestone.id} PASSED`);
  }
}

function usage() {
  return `Usage: node scripts/run-platform-milestones.mjs [--list | --all | --milestone Mx]

Without arguments, verifies every milestone through the active milestone.
--milestone may only target the active milestone or an earlier one.
--all previews the complete roadmap and stops at the first incomplete or failing milestone.
There is deliberately no skip or continue-on-error option.`;
}

function parseArguments(args) {
  if (args.length === 0) return { mode: "active" };
  if (args.length === 1 && args[0] === "--list") return { mode: "list" };
  if (args.length === 1 && args[0] === "--all") return { mode: "all" };
  if (args.length === 2 && args[0] === "--milestone") return { mode: "target", target: args[1] };
  throw new Error(usage());
}

export function main(args = process.argv.slice(2)) {
  validateManifest(milestones, activeMilestone);
  const parsed = parseArguments(args);
  const activeIndex = milestones.findIndex(({ id }) => id === activeMilestone);

  if (parsed.mode === "list") {
    for (const milestone of milestones) {
      const state = milestone.id === activeMilestone ? "ACTIVE" : "PLANNED";
      process.stdout.write(`${milestone.id}\t${state}\t${milestone.name}\n`);
    }
    return;
  }

  let target = activeMilestone;
  if (parsed.mode === "all") target = milestones.at(-1).id;
  if (parsed.mode === "target") {
    const targetIndex = milestones.findIndex(({ id }) => id === parsed.target);
    if (targetIndex < 0) throw new Error(`Unknown milestone: ${parsed.target}`);
    if (targetIndex > activeIndex) {
      throw new Error(`Cannot bypass active milestone ${activeMilestone}; use --all only to preview the fail-fast roadmap`);
    }
    target = parsed.target;
  }

  const plan = milestonesThrough(milestones, target);
  process.stdout.write(`Active milestone: ${activeMilestone}. Verifying ${plan.length} milestone(s) through ${target}.\n`);
  runMilestones(plan);
  process.stdout.write(`\nAll required gates through ${target} passed.\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\nMILESTONE BLOCKED\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
