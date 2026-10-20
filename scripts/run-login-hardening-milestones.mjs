import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { milestonesThrough, runMilestones, validateManifest } from "./run-platform-milestones.mjs";
import { activeMilestone, milestones } from "./login-hardening-milestones.config.mjs";

function usage() {
  return `Usage: node scripts/run-login-hardening-milestones.mjs [--list | --all | --milestone Mx]

Without arguments, verification stops at the active milestone.
--all previews the roadmap and fails closed at the first unfinished milestone.
There is no skip or continue-on-error option.`;
}

export function main(args = process.argv.slice(2)) {
  validateManifest(milestones, activeMilestone);
  if (args.length === 1 && args[0] === "--list") {
    const activeIndex = milestones.findIndex(({ id }) => id === activeMilestone);
    for (const [index, milestone] of milestones.entries()) {
      const state = index < activeIndex ? "PASSED" : index === activeIndex ? "ACTIVE" : "PLANNED";
      process.stdout.write(`${milestone.id}\t${state}\t${milestone.name}\n`);
    }
    return;
  }

  let target = activeMilestone;
  if (args.length === 1 && args[0] === "--all") target = milestones.at(-1).id;
  else if (args.length === 2 && args[0] === "--milestone") {
    const requestedIndex = milestones.findIndex(({ id }) => id === args[1]);
    const activeIndex = milestones.findIndex(({ id }) => id === activeMilestone);
    if (requestedIndex < 0) throw new Error(`Unknown milestone: ${args[1]}`);
    if (requestedIndex > activeIndex) throw new Error(`Cannot bypass active milestone ${activeMilestone}`);
    target = args[1];
  } else if (args.length !== 0) throw new Error(usage());

  const plan = milestonesThrough(milestones, target);
  process.stdout.write(`Active login-hardening milestone: ${activeMilestone}. Verifying through ${target}.\n`);
  runMilestones(plan);
  process.stdout.write(`\nAll required login-hardening gates through ${target} passed.\n`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\nLOGIN HARDENING MILESTONE BLOCKED\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
