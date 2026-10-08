import { beforeEach, describe, expect, it } from "vitest";
import { createFeature } from "../features";
import { createTask, deleteTask, listTasks, updateTask } from "../tasks";
import { createTestD1 } from "./d1";

const scope = { orgId: 1, projectId: "proj_a", userLogin: "jasper" };

describe("Planning tasks", () => {
  let db: D1Database;
  beforeEach(() => { db = createTestD1(); });

  it("creates general and feature tasks with one owner and an independent stage", async () => {
    await createFeature(db, scope, { title: "Search" });
    const general = await createTask(db, scope, { title: "Call customer", color: "yellow" });
    const linked = await createTask(db, scope, { title: "Write empty state", owner: "alex", color: "purple", featureNumber: 1 });
    expect(general).toMatchObject({ status: 201, data: { owner: "jasper", color: "yellow", featureNumber: null, stageId: "todo", status: "open" } });
    expect(linked).toMatchObject({ status: 201, data: { owner: "alex", color: "purple", featureNumber: 1, stageId: "todo" } });
    expect((await listTasks(db, scope, { owner: "alex" })).data).toMatchObject([{ title: "Write empty state" }]);
  });

  it("moves a task between independent stages", async () => {
    const created = await createTask(db, scope, { title: "Ship docs" });
    const id = (created.data as { id: string }).id;
    expect((await updateTask(db, scope, id, { stageId: "review", position: 3 })).data).toMatchObject({ stageId: "review", position: 3 });
  });

  it("keeps linked tasks attached while their feature moves", async () => {
    await createFeature(db, scope, { title: "Search" });
    const created = await createTask(db, scope, { title: "Test keyboard", featureNumber: 1 });
    const id = (created.data as { id: string }).id;
    expect((await updateTask(db, scope, id, { status: "completed" })).data).toMatchObject({ status: "completed", featureNumber: 1 });
    expect((await updateTask(db, scope, id, { status: "open" })).data).toMatchObject({ status: "open", featureNumber: 1, completedAt: null });
  });

  it("isolates projects and limits changes to owner, creator, or admin", async () => {
    const created = await createTask(db, scope, { title: "Private task", owner: "alex" });
    const id = (created.data as { id: string }).id;
    expect((await listTasks(db, { ...scope, projectId: "proj_b" })).data).toEqual([]);
    expect(await updateTask(db, { ...scope, userLogin: "outsider" }, id, { title: "Hijack" })).toMatchObject({ status: 403 });
    expect(await deleteTask(db, { ...scope, userLogin: "alex" }, id)).toMatchObject({ status: 200, data: { ok: true } });
  });

  it("rejects unknown feature links and arbitrary colors", async () => {
    expect(await createTask(db, scope, { title: "Invalid", featureNumber: 99 })).toMatchObject({ status: 422 });
    expect(await createTask(db, scope, { title: "Invalid", color: "rainbow" })).toMatchObject({ status: 400 });
  });
});
