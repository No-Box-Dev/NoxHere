import { describe, expect, it, vi } from "vitest";
import { parseReplayArgs, replaySql, runReplay } from "./replay-platform-events.mjs";

describe("platform event replay", () => {
  it("is a dry run unless execute is explicit", () => {
    const spawn = vi.fn();
    const result = runReplay(["--org-id", "7", "--project-id", "checkout"], spawn);
    expect(result.dryRun).toBe(true);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("requires an explicit local or remote target before mutation", () => {
    expect(() => parseReplayArgs(["--org-id", "7", "--project-id", "checkout", "--execute"]))
      .toThrow("requires exactly one");
  });

  it("builds a bounded, scoped replay without deleting projection data", () => {
    const options = parseReplayArgs([
      "--org-id", "7", "--project-id", "checkout", "--types", "feedback.report.created,feedback.report.resolved",
      "--from", "2026-10-01T00:00:00Z", "--limit", "250", "--local",
    ]);
    const sql = replaySql(options);
    expect(sql).toContain("org_id = 7");
    expect(sql).toContain("project_id = 'checkout'");
    expect(sql).toContain("LIMIT 250");
    expect(sql).not.toMatch(/DELETE|DROP/i);
  });

  it("rejects unknown event types and oversized runs", () => {
    expect(() => parseReplayArgs(["--org-id", "7", "--project-id", "p", "--types", "custom.anything"]))
      .toThrow("unknown platform event type");
    expect(() => parseReplayArgs(["--org-id", "7", "--project-id", "p", "--limit", "5001"]))
      .toThrow("between 1 and 5000");
  });
});
