import { describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestHead } from "../feedback/assets/[assetId]";

const assetId = "asset_0123456789abcdef0123456789abcdef";

function context(overrides: { projectId?: string; row?: Record<string, unknown> | null } = {}) {
  const row = overrides.row === undefined ? {
    id: assetId,
    report_id: "report-1",
    project_id: "project-1",
    role: "screenshot",
    media_type: "image/png",
    size_bytes: 4,
    sha256: "abcd",
    r2_key: `evidence/${assetId}`,
    expires_at: null,
    deleted_at: null,
  } : overrides.row;
  const first = vi.fn(async () => row);
  const object = {
    body: new Response(new Uint8Array([1, 2, 3, 4])).body,
    httpEtag: '"etag-1"',
  };
  return {
    env: {
      DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) },
      FEEDBACK_ASSETS: {
        get: vi.fn(async () => object),
        head: vi.fn(async () => object),
      },
    },
    data: { orgId: 7, projectId: overrides.projectId ?? "project-1" },
    params: { assetId },
    request: new Request(`https://app.noxhere.com/api/v1/feedback/assets/${assetId}`),
  };
}

describe("Feedback evidence API", () => {
  it("streams authorized private evidence with immutable identity metadata", async () => {
    const ctx = context();
    const response = await onRequestGet(ctx as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-NoxHere-Evidence-Id")).toBe(assetId);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it("supports metadata-only HEAD requests", async () => {
    const ctx = context();
    const response = await onRequestHead(ctx as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(await response.text()).toBe("");
    expect(ctx.env.FEEDBACK_ASSETS.head).toHaveBeenCalledWith(`evidence/${assetId}`);
    expect(ctx.env.FEEDBACK_ASSETS.get).not.toHaveBeenCalled();
  });

  it("conceals evidence outside the authenticated scope", async () => {
    const response = await onRequestGet(context({ row: null }) as never);
    expect(response.status).toBe(404);
  });

  it("returns gone for expired evidence", async () => {
    const ctx = context({ row: {
      id: assetId, report_id: "report-1", project_id: "project-1", role: "screenshot",
      media_type: "image/png", size_bytes: 4, sha256: "abcd", r2_key: `evidence/${assetId}`,
      expires_at: "2020-01-01T00:00:00.000Z", deleted_at: null,
    } });
    const response = await onRequestGet(ctx as never);
    expect(response.status).toBe(410);
    expect(ctx.env.FEEDBACK_ASSETS.get).not.toHaveBeenCalled();
  });
});
