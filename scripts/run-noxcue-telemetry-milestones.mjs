import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runMilestones,
  milestonesThrough,
  validateManifest,
} from "./run-platform-milestones.mjs";
import {
  activeMilestone,
  milestones,
} from "./noxcue-telemetry-milestones.config.mjs";

function usage() {
  return `Usage: node scripts/run-noxcue-telemetry-milestones.mjs [--list | --all | --milestone Mx]

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
      const state = milestone.id === activeMilestone
        ? "ACTIVE"
        : milestones.indexOf(milestone) < activeIndex ? "COMPLETE" : "PLANNED";
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
  process.stdout.write(`Active NoxCue telemetry milestone: ${activeMilestone}. Verifying ${plan.length} milestone(s) through ${target}.\n`);
  runMilestones(plan);
  process.stdout.write(`\nAll required NoxCue telemetry gates through ${target} passed.\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\nNOXCUE TELEMETRY MILESTONE BLOCKED\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
