import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MilestoneFailure,
  milestonesThrough,
  runMilestones,
  validateManifest,
} from "./run-platform-milestones.mjs";

function milestone(id, requiredPaths = []) {
  return {
    id,
    name: `Milestone ${id}`,
    objective: `Prove ${id}`,
    requiredPaths,
    gates: [
      { name: `${id} first`, command: "first", args: [] },
      { name: `${id} second`, command: "second", args: [] },
    ],
  };
}

describe("platform milestone runner", () => {
  it("selects every prerequisite milestone in order", () => {
    const manifest = [milestone("M0"), milestone("M1"), milestone("M2")];
    expect(milestonesThrough(manifest, "M1").map(({ id }) => id)).toEqual(["M0", "M1"]);
  });

  it("rejects malformed manifests and unknown active milestones", () => {
    expect(() => validateManifest([milestone("M0"), milestone("M0")], "M0")).toThrow("Duplicate milestone id");
    expect(() => validateManifest([milestone("M0"), milestone("M2")], "M0")).toThrow("expected M1, received M2");
    expect(() => validateManifest([milestone("M0")], "M1")).toThrow("Active milestone does not exist");
  });

  it("blocks at setup before running a gate when a required file is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "nox-milestone-test-"));
    const runGate = vi.fn(() => ({ ok: true }));
    try {
      expect(() => runMilestones([milestone("M0", ["missing.ts"])], {
        root,
        runGate,
        write: () => undefined,
      })).toThrowError(new MilestoneFailure("M0", "setup", "required path is missing: missing.ts"));
      expect(runGate).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stops immediately on the first failed gate and never enters the next milestone", () => {
    const root = mkdtempSync(join(tmpdir(), "nox-milestone-test-"));
    const calls = [];
    try {
      expect(() => runMilestones([milestone("M0"), milestone("M1")], {
        root,
        write: () => undefined,
        runGate(gate, { milestone: current }) {
          calls.push(`${current.id}:${gate.command}`);
          return gate.command === "second" ? { ok: false, reason: "intentional failure" } : { ok: true };
        },
      })).toThrow("M0 blocked at “M0 second”: intentional failure");
      expect(calls).toEqual(["M0:first", "M0:second"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs all gates and milestones when every gate passes", () => {
    const root = mkdtempSync(join(tmpdir(), "nox-milestone-test-"));
    const nested = join(root, "packages", "contracts", "contract.ts");
    mkdirSync(join(root, "packages", "contracts"), { recursive: true });
    writeFileSync(nested, "export {};\n");
    const calls = [];
    try {
      runMilestones([milestone("M0"), milestone("M1", ["packages/contracts/contract.ts"])], {
        root,
        write: () => undefined,
        runGate(gate, { milestone: current }) {
          calls.push(`${current.id}:${gate.command}`);
          return { ok: true };
        },
      });
      expect(calls).toEqual(["M0:first", "M0:second", "M1:first", "M1:second"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
