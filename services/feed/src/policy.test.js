import { describe, expect, it } from "vitest";
import { buildPrompt, buildSlackResponse, buildTestResponse, getDefaultPrompt } from "./policy.js";

describe("NoxFeed response policy", () => {
  it("owns narration prompts", () => {
    const response = buildPrompt("actor", { actorName: "Alex", actorTone: "Dry", projectName: "Nox", event: { type: "github:pr:merged", created_at: "2026-08-22T12:00:00Z", payload: { pr: { number: 4, title: "Ship" } } } });
    expect(response).toMatchObject({ contract: "noxfeed.response", version: 1 });
    expect(response.prompt.user).toContain("Tone: Dry");
    expect(response.prompt.system).toContain("first-person");
    expect(response.prompt.system).toContain("between 25 and 70 words");
    expect(response.prompt.system).toContain("Do not wrap the JSON in markdown");
  });

  it("keeps mandatory word and format policy separate from user overrides", () => {
    const actor = buildPrompt("actor", {
      actorName: "Alex",
      projectName: "Nox",
      event: { type: "github:pr:opened", created_at: "2026-08-22T12:00:00Z" },
    }, "Use my concise house voice.");
    expect(actor.prompt.system).toContain("Use my concise house voice.");
    expect(actor.prompt.system).toContain("between 25 and 70 words");
    expect(actor.prompt.system).toContain("Return ONLY valid JSON");

    const opened = buildPrompt("pr_opened", {
      actorName: "Alex",
      projectName: "Nox",
      event: { type: "github:pr:opened", created_at: "2026-08-22T12:00:00Z" },
    }, "Use my detailed house voice.");
    expect(opened.prompt.system).toContain("first-person team post");
    expect(opened.prompt.system).toContain("between 25 and 70 words");

    const release = buildPrompt("release_notes", {
      projectName: "Nox",
      event: { type: "github:pr:merged", created_at: "2026-08-22T12:00:00Z" },
    }, "Emphasize operational consequences.");
    expect(release.prompt.system).toContain("Emphasize operational consequences.");
    expect(release.prompt.system).toContain("Aim for 180-400 words");
    expect(release.prompt.system).toContain("never exceed 650 words");
  });

  it("supplies canonical release metadata, including environment", () => {
    const response = buildPrompt("release_notes", {
      projectName: "Playnist",
      event: {
        type: "github:pr:merged",
        repo: "playnist",
        environment: "Production",
        created_at: "2026-08-30T01:30:41Z",
        payload: { pr: { number: 1397, title: "Launch", author: "Jasper", merged_by: "Jasper", head_ref: "develop", base_ref: "main" } },
      },
    });
    expect(response.prompt.system).toContain("Environment: [environment, when supplied]");
    expect(response.prompt.user).toContain("repository: playnist");
    expect(response.prompt.user).toContain("author: Jasper");
    expect(response.prompt.user).toContain("branch: develop → main");
    expect(response.prompt.user).toContain("environment: Production");
  });

  it("owns escaped Slack formatting and tests", () => {
    const slack = buildSlackResponse("posts", { actorName: "<Alex>", projectName: "Nox", summary: "5 < 10", prUrl: "https://github.com/a/b/pull/1", prNumber: 1 });
    expect(JSON.stringify(slack.message.blocks)).toContain("&lt;Alex&gt;");
    expect(buildTestResponse("Acme", "posts").message.text).toContain("posts");
  });

  it("renders the complete release note in Slack", () => {
    const slack = buildSlackResponse("release_notes", {
      projectName: "Playnist",
      interactionId: "731868",
      prUrl: "https://github.com/No-Box-Dev/playnist/pull/1397",
      summary: "✅ playnist #1397 Merged - Release\nEnvironment: Production\n\nChange Summary\nDetails: Shipped structured reviews.\n\nRecommendations\nWatch production.",
    });
    expect(JSON.stringify(slack.message.blocks)).toContain("Environment: Production");
    expect(JSON.stringify(slack.message.blocks)).toContain("Watch production");
    expect(slack.message.blocks.at(-1)).toMatchObject({
      type: "actions",
      elements: [{ type: "button", url: "https://github.com/No-Box-Dev/playnist/pull/1397" }],
    });
  });

  it("renders one combined message with the social post before the release note", () => {
    const slack = buildSlackResponse("release_notes", {
      projectName: "Playnist",
      prUrl: "https://github.com/No-Box-Dev/playnist/pull/1465",
      prNumber: 1465,
      post: {
        actorName: "Jasper",
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
        summary: "I cleared up the NoxSpot UI and URL handling.",
        technicalSummary: "What it does: Clarifies reporting\nHow it works: Normalizes URLs\nWhat it touches: NoxSpot UI",
      },
      summary: "✅ playnist #1465 Merged - Bugfix\n\nSummary\nOutcome: fixed eight issues.",
    });

    expect(slack.message.blocks[0]).toMatchObject({
      type: "section",
      text: { text: expect.stringContaining("I cleared up the NoxSpot UI") },
      accessory: { type: "image", image_url: "https://avatars.githubusercontent.com/u/1" },
    });
    expect(slack.message.blocks[1]).toMatchObject({ type: "section", text: { text: expect.stringContaining("Plain-English summary") } });
    expect(slack.message.blocks[1].text.text).toContain("What it does: Clarifies reporting");
    expect(slack.message.blocks[2]).toEqual({ type: "divider" });
    expect(slack.message.blocks[3]).toMatchObject({
      type: "section",
      text: { text: "*Release note* — `Playnist`" },
    });
    expect(JSON.stringify(slack.message.blocks.slice(4))).toContain("fixed eight issues");
    expect(slack.message.blocks.filter((block) => block.type === "actions")).toHaveLength(1);
  });

  it("splits long release notes without dropping content", () => {
    const marker = "end-of-release-note";
    const slack = buildSlackResponse("release_notes", {
      projectName: "Playnist",
      summary: `${"Change detail. ".repeat(300)}\n${marker}`,
    });
    expect(slack.message.blocks.length).toBeGreaterThan(2);
    expect(JSON.stringify(slack.message.blocks)).toContain(marker);
  });

  it("exposes the product-owned default release-notes prompt", () => {
    const response = getDefaultPrompt("release_notes");
    expect(response).toMatchObject({ contract: "noxfeed.response", version: 1 });
    expect(response.prompt.system).toContain("Operations");
    expect(response.prompt.system).toContain("Known Issues");
    expect(response.prompt.system).toContain("Aim for 180-400 words");
    expect(response.prompt.system.split(/\s+/).length).toBeLessThan(300);
  });
});
