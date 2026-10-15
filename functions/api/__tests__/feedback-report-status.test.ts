import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/feedback-resolution.js", () => ({
  updateFeedbackReport: vi.fn(),
}));

import { onRequestGet, onRequestPatch } from "../feedback/reports/[id]";
import { updateFeedbackReport } from "../../lib/feedback-resolution.js";

function context(body: unknown, data: Record<string, unknown> = {}) {
  return {
    env: { DB: {}, TASK_QUEUE: { send: vi.fn() } },
    data: {
      orgId: 7, orgLogin: "acme", userLogin: "maintainer", isAdmin: true,
      projectId: "project-1", auth: { type: "session" }, ...data,
    },
    params: { id: "capture-1" },
    request: new Request("https://app.noxhere.com/api/v1/feedback/reports/capture-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  };
}

describe("Feedback report status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateFeedbackReport).mockResolvedValue({ id: "capture-1", status: "resolved" } as never);
  });

  it("lets an admin resolve and notify an opted-in reporter", async () => {
    const response = await onRequestPatch(context({ status: "resolved", summary: "Fixed.", notify: true }) as never);
    expect(response.status).toBe(200);
    expect(updateFeedbackReport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      reportId: "capture-1", orgId: 7, projectId: "project-1", status: "resolved",
      summary: "Fixed.", notify: true, source: "platform",
    }));
  });

  it("rejects notification requests for non-resolved states", async () => {
    const response = await onRequestPatch(context({ status: "investigating", notify: true }) as never);
    expect(response.status).toBe(400);
    expect(updateFeedbackReport).not.toHaveBeenCalled();
  });

  it("allows a project API token and marks the audit source", async () => {
    const response = await onRequestPatch(context({ status: "investigating" }, {
      isAdmin: false, auth: { type: "api_token" }, userLogin: "api-token",
    }) as never);
    expect(response.status).toBe(200);
    expect(updateFeedbackReport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: "api" }));
  });

  it("rejects a non-admin browser member", async () => {
    const response = await onRequestPatch(context({ status: "resolved" }, { isAdmin: false }) as never);
    expect(response.status).toBe(403);
  });

  it("returns authenticated evidence metadata with the report", async () => {
    const report = {
      id: "capture-1", project_id: "project-1", site_id: "site-1", repo: "web",
      issue_number: 42, issue_url: "https://github.com/acme/web/issues/42", title: "Broken",
      reporter_name: "Ada", reporter_avatar_url: null, status: "open", resolution_summary: null,
      resolved_at: null, resolved_by: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
    };
    const asset = {
      id: "asset_0123456789abcdef0123456789abcdef", role: "screenshot", media_type: "image/png",
      size_bytes: 4, sha256: "abcd", created_at: "2026-10-01T00:00:00Z", expires_at: null,
    };
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => sql.includes("FROM spot_reports")
        ? { first: vi.fn(async () => report) }
        : { all: vi.fn(async () => ({ results: [asset] })) }),
    }));
    const ctx = context({}, {});
    ctx.env.DB = { prepare };
    ctx.request = new Request("https://app.noxhere.com/api/v1/feedback/reports/capture-1");
    const response = await onRequestGet(ctx as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      report: {
        id: "capture-1",
        evidence: [{
          id: asset.id,
          url: `/api/v1/feedback/assets/${asset.id}`,
          mediaType: "image/png",
        }],
      },
    });
  });
});
