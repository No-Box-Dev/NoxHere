import { afterEach, describe, expect, it, vi } from "vitest";
import { generateContent, generationInfo, parseNarrativeOutput } from "./generation.js";

const INPUT = {
  actorName: "Alex",
  actorTone: "Dry",
  projectName: "NoxConnect",
  event: {
    type: "github:pr:opened",
    repo: "noxconnect",
    environment: "Production",
    summary: "PR #42: improve login",
    created_at: "2026-09-11T10:00:00Z",
    payload: {
      pr: {
        number: 42,
        title: "Improve login",
        author: "alex",
        merged_by: "sam",
        head_ref: "fix/login",
        base_ref: "main",
      },
    },
  },
};

function anthropicResponse(text, extra = {}) {
  return new Response(JSON.stringify({
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    ...extra,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("NoxFeed generation", () => {
  it("owns and reports the provider model", () => {
    expect(generationInfo(true)).toEqual({
      contract: "noxfeed.response",
      version: 1,
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      available: true,
    });
    expect(generationInfo().available).toBe(false);
  });

  it("builds the prompt, calls Anthropic, and returns validated post output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(anthropicResponse(JSON.stringify({
      social: "I made login reconnect reliably so expired sessions recover cleanly and account access stays clear without sending people through a confusing retry loop.",
      technical: [
        "What it does: Keeps login sessions reliable",
        "How it works: Validates the reconnect state before continuing",
        "What it touches: Authentication and account onboarding",
      ],
    })));

    const result = await generateContent("pr_opened", INPUT, undefined, "managed-key");

    expect(result.generation).toMatchObject({
      status: "generated",
      model: "claude-haiku-4-5-20251001",
      output: {
        summary: "I made login reconnect reliably so expired sessions recover cleanly and account access stays clear without sending people through a confusing retry loop.",
        technicalSummary: expect.stringContaining("What it does:"),
      },
    });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.system).toContain("short team post");
    expect(request.system).toContain("first-person team post");
    expect(request.messages[0].content).toContain("Improve login");
  });

  it("normalizes release metadata before returning the note", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(anthropicResponse(
      "✅ [repo] #[number] Merged — Bugfix\n\nSummary\nOutcome: Login works.",
    ));

    const result = await generateContent("release_notes", {
      ...INPUT,
      event: { ...INPUT.event, type: "github:pr:merged" },
    }, undefined, "managed-key");

    expect(result.generation.output.summary).toContain("Repository: noxconnect");
    expect(result.generation.output.summary).toContain("Pull Request: #42 - Improve login");
    expect(result.generation.output.summary).toContain("Author: alex | Merged by: sam");
    expect(result.generation.output.summary).toContain("Environment: Production");
  });

  it("returns a typed unavailable result without exposing provider details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("denied", { status: 401 }));
    const result = await generateContent("actor", INPUT, undefined, "bad-key");
    expect(result.generation).toEqual({
      status: "unavailable",
      model: "claude-haiku-4-5-20251001",
      errorCode: "provider_http_error",
    });
    expect(JSON.stringify(result)).not.toContain("denied");
  });

  it("fails closed when the product service has no managed key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await generateContent("actor", INPUT, undefined, undefined);
    expect(result.generation.errorCode).toBe("managed_key_missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("post output parsing", () => {
  const context = {
    projectName: "Billing",
    eventSummary: "PR #7: prevent duplicate charges",
    payload: { pr: { title: "Prevent duplicate charges", changed_files: 3 } },
  };

  it("normalizes social and three-line technical output", () => {
    const result = parseNarrativeOutput(JSON.stringify({
      social: "I stopped duplicate invoice charges.",
      technical: ["Prevents duplicates", "Adds an idempotency guard", "Billing API"],
    }), context);
    expect(result.social).toBe("I stopped duplicate invoice charges.");
    expect(result.technicalSummary.split("\n")).toEqual([
      "What it does: Prevents duplicates",
      "How it works: Adds an idempotency guard",
      "What it touches: Billing API",
    ]);
  });

  it("does not expose malformed structured output as a post", () => {
    const result = parseNarrativeOutput('{"social":"incomplete', context);
    expect(result.social).toBe("Prevent duplicate charges");
    expect(result.technicalSummary).toContain("What it touches: Billing across 3 changed files");
  });
});
