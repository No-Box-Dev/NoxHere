import { beforeEach, describe, expect, it, vi } from "vitest";

const { publishPlatformEvent } = vi.hoisted(() => ({ publishPlatformEvent: vi.fn() }));
vi.mock("../../lib/platform-event-store", () => ({ publishPlatformEvent }));

import { onRequestPost } from "../v1/developer-feedback";

function context(body: unknown, overrides: Record<string, unknown> = {}, count = 0) {
  const first = vi.fn(async () => ({ count }));
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    env: { DB: { prepare }, TASK_QUEUE: { send: vi.fn() } },
    data: {
      orgId: 7,
      projectId: "project-1",
      userLogin: "agent",
      auth: { type: "api_token", id: "noxkey_1" },
      ...overrides,
    },
    request: new Request("https://app.noxhere.com/api/v1/developer-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

const valid = {
  area: "api",
  category: "friction",
  summary: "Project selection was unclear",
  details: "The response did not identify the project selected by the token.",
  suggestedChange: "Return the resolved project ID in the response.",
  operationId: "listNoxServices",
  impact: "medium",
  idempotencyKey: "agent-run-12345678",
  client: { name: "example-agent", version: "1.0.0" },
};

describe("developer feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishPlatformEvent.mockResolvedValue({
      event: { id: "feedback-id", receivedAt: "2026-10-07T00:00:00.000Z" },
      duplicate: false,
      queued: true,
    });
  });

  it("publishes a canonical project event and acknowledges receipt", async () => {
    const response = await onRequestPost(context(valid) as never);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      feedback: { id: "feedback-id", status: "received", duplicate: false },
    });
    expect(publishPlatformEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: "feedback.developer.submitted",
      projectId: "project-1",
      idempotencyKey: "agent-run-12345678",
      data: expect.objectContaining({ area: "api", category: "friction" }),
    }));
  });

  it("requires explicit project context", async () => {
    const response = await onRequestPost(context(valid, { projectId: null }) as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "project_required" } });
    expect(publishPlatformEvent).not.toHaveBeenCalled();
  });

  it("rejects likely credentials in free text", async () => {
    const response = await onRequestPost(context({ ...valid, details: "Bearer ghp_abcdefghijklmnopqrstuvwxyz123456" }) as never);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "sensitive_content_rejected" } });
    expect(publishPlatformEvent).not.toHaveBeenCalled();
  });

  it("rejects direct personal identifiers", async () => {
    const response = await onRequestPost(context({ ...valid, details: "This affected person@example.com." }) as never);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "sensitive_content_rejected" } });
    expect(publishPlatformEvent).not.toHaveBeenCalled();
  });

  it("rate limits noisy clients and exposes Retry-After", async () => {
    const response = await onRequestPost(context(valid, {}, 10) as never);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(publishPlatformEvent).not.toHaveBeenCalled();
  });
});
