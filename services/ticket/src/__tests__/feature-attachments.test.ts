import { beforeEach, describe, expect, it } from "vitest";
import { createFeature } from "../features";
import { deleteFeatureAttachment, getFeatureAttachment, listFeatureAttachments, putFeatureAttachment } from "../feature-attachments";
import { createTestD1 } from "./d1";

const scope = { orgId: 1, projectId: "proj_a", userLogin: "jasper" };

describe("NoxTicket feature attachments", () => {
  let db: D1Database;
  let objects: Map<string, ArrayBuffer>;
  let bucket: R2Bucket;

  beforeEach(() => {
    db = createTestD1();
    objects = new Map();
    bucket = {
      put: async (key: string, value: ArrayBuffer) => { objects.set(key, value); return {} as R2Object; },
      get: async (key: string) => objects.has(key) ? { body: objects.get(key) } as unknown as R2ObjectBody : null,
      delete: async (key: string) => { objects.delete(key); },
    } as unknown as R2Bucket;
  });

  it("stores, lists, streams, and deletes a screenshot", async () => {
    await createFeature(db, scope, { title: "Screenshot support" });
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    const uploaded = await putFeatureAttachment(db, bucket, scope, 1, "screen.png", bytes);
    expect(uploaded).toMatchObject({ ok: true, status: 201, data: { filename: "screen.png", contentType: "image/png", kind: "image" } });
    expect((await listFeatureAttachments(db, scope, 1)).data).toMatchObject({ attachments: [{ filename: "screen.png" }] });

    const response = await getFeatureAttachment(db, bucket, scope, 1, 1);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));

    expect(await deleteFeatureAttachment(db, bucket, scope, 1, 1)).toMatchObject({ ok: true, data: { id: 1 } });
    expect((await listFeatureAttachments(db, scope, 1)).data).toEqual({ attachments: [] });
  });

  it("rejects unsafe and out-of-scope attachments", async () => {
    await createFeature(db, scope, { title: "Scoped files" });
    expect(await putFeatureAttachment(db, bucket, scope, 1, "payload.svg", new Uint8Array([1]).buffer)).toMatchObject({ ok: false, status: 415 });
    expect(await listFeatureAttachments(db, { ...scope, projectId: "proj_b" }, 1)).toMatchObject({ ok: false, status: 404 });
  });
});
