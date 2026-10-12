import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTelemetryDigestResponse, getTelemetryTestResponse } from "../telemetry-response.js";
import { generateActivityContent, getActivityGenerationInfo, getActivitySlackResponse } from "../activity-response.js";
import { buildPlanningActivityResponse, buildPlanningFeatureAddedResponse, buildPlanningTestResponse } from "../../products/planning/response.js";

describe("product response boundaries", () => {
  it("keeps product presentation out of shared plumbing", () => {
    const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
    expect(read("../slack.js")).not.toMatch(/buildPostsBlocks|buildReleaseNotesBlocks/);
    expect(read("../narrator.js")).not.toMatch(/ACTOR_SYSTEM|PR_OPENED_SYSTEM|RELEASE_NOTES_SYSTEM/);
    expect(read("../feedback.js")).not.toMatch(/api\.github\.com|Authorization:\s*`Bearer/);
    expect(read("../../api/slack/test.js")).not.toMatch(/Nox(Telemetry|Spot|Feed|Ticket) delivery test/);
    expect(read("../../../apps/web/src/api/platform.ts")).not.toMatch(/@octokit|api\.github\.com|\.rest\.(issues|pulls)/);
    expect(read("../github-issues.js")).toContain("NoxHere's GitHub issue transport");
  });

  it("validates Telemetry's versioned service response", async () => {
    const service = {
      buildTestResponse: vi.fn(async () => ({ contract: "telemetry.response", version: 1, message: { text: "Test", blocks: [{ type: "section" }] } })),
    };
    expect((await getTelemetryTestResponse({ TELEMETRY_RESPONSE: service }, "Acme")).message.text).toBe("Test");
    await expect(getTelemetryTestResponse({}, "Acme")).rejects.toThrow("service binding is unavailable");
  });

  it("validates Telemetry's daily digest response", async () => {
    const service = {
      buildDigestResponse: vi.fn(async () => ({
        contract: "telemetry.response", version: 1, kind: "daily_digest",
        message: { text: "Daily", blocks: [{ type: "section" }] },
      })),
    };
    expect((await getTelemetryDigestResponse(
      { TELEMETRY_RESPONSE: service }, "Acme", "2026-08-29", { "users.new": 4 },
    )).message.text).toBe("Daily");
    expect(service.buildDigestResponse).toHaveBeenCalledWith(
      "Acme", "2026-08-29", { "users.new": 4 }, {}, {}, {}, undefined,
    );
  });

  it("validates Activity prompts and Slack responses", async () => {
    const service = {
      generate: vi.fn(async () => ({ contract: "activity.response", version: 1, generation: { status: "generated", model: "model-1", output: { summary: "Post", technicalSummary: "What it does: A\nHow it works: B\nWhat it touches: C" } } })),
      generationInfo: vi.fn(async () => ({ contract: "activity.response", version: 1, model: "model-1", provider: "anthropic", available: true })),
      buildSlackResponse: vi.fn(async () => ({ contract: "activity.response", version: 1, message: { text: "Post", blocks: [{ type: "section" }] } })),
      buildTestResponse: vi.fn(),
    };
    expect((await generateActivityContent({ ACTIVITY_RESPONSE: service }, "actor", {})).output.summary).toBe("Post");
    expect(await getActivityGenerationInfo({ ACTIVITY_RESPONSE: service })).toEqual({ model: "model-1", provider: "anthropic", available: true });
    expect((await getActivitySlackResponse({ ACTIVITY_RESPONSE: service }, "posts", {})).message.text).toBe("Post");
  });

  it("rejects generation readiness responses without explicit availability", async () => {
    const service = {
      generationInfo: vi.fn(async () => ({ contract: "activity.response", version: 1, model: "model-1", provider: "anthropic" })),
    };
    await expect(getActivityGenerationInfo({ ACTIVITY_RESPONSE: service })).rejects.toThrow(
      "Invalid Activity generation info",
    );
  });

  it("keeps Planning policy outside shared connector modules", () => {
    const activity = buildPlanningActivityResponse({ orgId: 7, repo: "app", action: "opened", actor: "Ada", issue: { number: 3, title: "Fix <button>", html_url: "https://github.com/acme/app/issues/3" } });
    expect(activity.message.text).toBe("Planning opened: Fix <button>");
    expect(JSON.stringify(activity.message.blocks)).toContain("Fix &lt;button&gt;");
    expect(buildPlanningTestResponse("Acme").message.text).toContain("Planning");
  });

  it("builds a compact one-line Planning feature-added message", () => {
    const response = buildPlanningFeatureAddedResponse({
      orgId: 7,
      projectId: "project-1",
      actor: "Ada",
      feature: { number: 4, title: "Sharing <beta>", description: "Share A & B", backlog: true },
    });
    expect(response.message.text).toContain("Backlog");
    expect(response.message.blocks).toEqual([{ type: "section", text: { type: "mrkdwn", text: "*Feature #4 · Sharing &lt;beta&gt;* — Backlog · added by Ada" } }]);
  });
});
