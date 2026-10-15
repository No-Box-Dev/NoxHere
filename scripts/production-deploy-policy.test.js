import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("production deployment policy", () => {
  it("refuses the production source guard outside GitHub Actions", () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./assert-main-release.mjs", import.meta.url))], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_ACTIONS: "false" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("local production deploys are disabled");
  });

  it("allows app production only after successful main CI", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    expect(workflow).not.toContain("workflow_dispatch");
    expect(workflow).toContain("branches: [main]");
    expect(workflow.match(/node scripts\/assert-main-release\.mjs/g)).toHaveLength(2);
  });

  it("allows widget production only from a main push", () => {
    const workflow = read(".github/workflows/deploy-feedback-widget.yml");
    expect(workflow).not.toContain("workflow_dispatch");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("node ../../scripts/assert-main-release.mjs");
  });

  it("guards every supported package-level production deploy", () => {
    const manifests = [
      "package.json",
      "services/activity/package.json",
      "services/feedback/package.json",
      "services/gateway/package.json",
      "services/planning/package.json",
      "services/telemetry/package.json",
    ];
    for (const manifest of manifests) {
      expect(read(manifest), manifest).toContain("assert-main-release.mjs");
    }
  });
});
