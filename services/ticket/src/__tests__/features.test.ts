import { beforeEach, describe, expect, it } from "vitest";
import { createFeature, listFeatures, updateFeature } from "../features";
import { createSpec, listSpecs } from "../specs";
import { createTestD1 } from "./d1";

const scope = { orgId: 1, projectId: "proj_a", userLogin: "jasper" };
const otherProject = { ...scope, projectId: "proj_b" };

describe("NoxTicket features", () => {
  let db: D1Database;
  beforeEach(() => { db = createTestD1(); });

  it("creates a feature in the first stage and lists it", async () => {
    const created = await createFeature(db, scope, { title: "  Dark mode  ", owners: ["jasper"] });
    expect(created).toMatchObject({ ok: true, status: 201, data: { number: 1, title: "Dark mode", status: "todo", backlog: false, priority: 3, state: "open", owners: ["jasper"], createdBy: "jasper" } });
    const listed = await listFeatures(db, scope);
    expect(listed.data).toHaveLength(1);
  });

  it("keeps projects apart", async () => {
    await createFeature(db, scope, { title: "Only in A" });
    expect((await listFeatures(db, otherProject)).data).toEqual([]);
    expect(await updateFeature(db, otherProject, 1, { title: "Hijack" })).toMatchObject({ ok: false, status: 404 });
  });

  it("records status moves and rejects unknown stages", async () => {
    await createFeature(db, scope, { title: "Search" });
    const moved = await updateFeature(db, scope, 1, { status: "staging", backlog: true });
    expect(moved.data).toMatchObject({ status: "staging", backlog: true });
    expect((moved.data as { statusHistory: Array<{ status: string }> }).statusHistory.map((entry) => entry.status)).toEqual(["todo", "staging"]);
    expect(await updateFeature(db, scope, 1, { status: "nope" })).toMatchObject({ ok: false, status: 422 });
  });

  it("stores a feature description and multiple links", async () => {
    const created = await createFeature(db, scope, {
      title: "Sharing",
      description: "Let players share collections.",
      links: [
        { label: "Design", url: "https://figma.com/file/example" },
        { label: "Pull request", url: "https://github.com/example/repo/pull/1" },
      ],
    });
    expect(created.data).toMatchObject({
      description: "Let players share collections.",
      links: [{ label: "Design" }, { label: "Pull request" }],
    });

    const updated = await updateFeature(db, scope, 1, {
      description: "Share profiles and collections.",
      links: [{ label: "Live page", url: "https://example.com/collections/1" }],
    });
    expect(updated.data).toMatchObject({
      description: "Share profiles and collections.",
      links: [{ label: "Live page", url: "https://example.com/collections/1" }],
    });
  });

  it("stores backlog priority from 1 to 5", async () => {
    const created = await createFeature(db, scope, { title: "Urgent fix", backlog: true, priority: 1 });
    expect(created.data).toMatchObject({ backlog: true, priority: 1 });
    expect((await updateFeature(db, scope, 1, { priority: 5 })).data).toMatchObject({ priority: 5 });
    expect(await updateFeature(db, scope, 1, { priority: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(await updateFeature(db, scope, 1, { priority: 6 })).toMatchObject({ ok: false, status: 400 });
  });

  it("closes and reopens a feature", async () => {
    await createFeature(db, scope, { title: "Export" });
    const closed = await updateFeature(db, scope, 1, { state: "closed" });
    expect(closed.data).toMatchObject({ state: "closed" });
    expect((closed.data as { closedAt: string | null }).closedAt).toBeTruthy();
    expect((await listFeatures(db, scope, "open")).data).toEqual([]);
    expect((await listFeatures(db, scope, "closed")).data).toHaveLength(1);
    const reopened = await updateFeature(db, scope, 1, { state: "open" });
    expect(reopened.data).toMatchObject({ state: "open", closedAt: null });
  });

  it("validates input", async () => {
    expect(await createFeature(db, scope, { title: "" })).toMatchObject({ ok: false, status: 400 });
    expect(await createFeature(db, scope, { title: "x", repo: "a/b" })).toMatchObject({ ok: false, status: 400 });
    expect(await updateFeature(db, scope, 1, {})).toMatchObject({ ok: false, status: 400 });
    expect(await createFeature(db, { ...scope, projectId: "" }, { title: "x" })).toMatchObject({ ok: false, status: 400 });
  });

  it("links specs only to features in the same project", async () => {
    await createFeature(db, scope, { title: "Billing" });
    expect(await createSpec(db, scope, { title: "Billing spec", featureNumber: 1 })).toMatchObject({ ok: true, status: 201 });
    expect(await createSpec(db, otherProject, { title: "Stray", featureNumber: 1 })).toMatchObject({ ok: false, status: 400 });
    expect((await listSpecs(db, otherProject)).data).toEqual({ specs: [] });
  });
});
