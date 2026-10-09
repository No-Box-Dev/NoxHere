import { beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  complete: vi.fn(),
  resolveLlmConfig: vi.fn(),
}));

vi.mock("../../lib/llm.js", () => ({ complete: providers.complete }));
vi.mock("../../lib/llm-config.js", () => ({ resolveLlmConfig: providers.resolveLlmConfig }));

import { onRequestPost } from "../planning/assist";

function context(body: unknown, projectId: string | null = "project-1") {
  return {
    env: { DB: {}, ANTHROPIC_API_KEY: "managed-key" },
    data: { orgId: 7, projectId },
    request: new Request("https://app.noxhere.com/api/v1/planning/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

describe("Planning assistant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providers.resolveLlmConfig.mockResolvedValue({ status: "ready", provider: "anthropic", apiKey: "managed-key" });
  });

  it("returns a validated draft and only accepts a supplied feature number", async () => {
    providers.complete.mockResolvedValue('{"message":"I added a clear outcome.","title":"Check mobile checkout","description":"Verify checkout works on supported mobile browsers.","featureNumber":9}');
    const response = await onRequestPost(context({
      kind: "task",
      prompt: "mobile checkout is flaky",
      owner: "jasper",
      features: [{ number: 9, title: "Checkout", owners: ["jasper"] }],
    }) as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ draft: { message: "I added a clear outcome.", title: "Check mobile checkout", description: "Verify checkout works on supported mobile browsers.", featureNumber: 9 } });
    expect(providers.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tag: "planning-assistant", maxTokens: 520 }));
  });

  it("drops invented feature links from the model response", async () => {
    providers.complete.mockResolvedValue('{"title":"Write the launch note","description":"Draft and review the launch note.","featureNumber":999}');
    const response = await onRequestPost(context({ kind: "task", prompt: "write launch note", features: [] }) as never);
    await expect(response.json()).resolves.toEqual({ draft: { title: "Write the launch note", description: "Draft and review the launch note.", featureNumber: null, message: "Draft updated." } });
  });

  it("rejects invalid input before calling the model", async () => {
    const response = await onRequestPost(context({ kind: "task", prompt: "" }) as never);
    expect(response.status).toBe(400);
    expect(providers.complete).not.toHaveBeenCalled();
  });

  it("reports disabled AI without calling the model", async () => {
    providers.resolveLlmConfig.mockResolvedValue({ status: "disabled" });
    const response = await onRequestPost(context({ kind: "feature", prompt: "add exports" }) as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "ai_unavailable" });
    expect(providers.complete).not.toHaveBeenCalled();
  });
});
