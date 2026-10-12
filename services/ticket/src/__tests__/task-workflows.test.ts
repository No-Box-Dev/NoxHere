import { beforeEach, describe, expect, it } from "vitest";
import { createTask, listTasks, updateTask } from "../tasks";
import { getTaskWorkflow, GTD_TASK_STAGES, putTaskWorkflow } from "../task-workflows";
import { createTestD1 } from "./d1";

const scope = { orgId: 1, projectId: "proj_a", userLogin: "jasper" };

describe("personal task workflows", () => {
  let db: D1Database;
  beforeEach(() => { db = createTestD1(); });

  it("returns the GTD workflow for a person without custom settings", async () => {
    expect(await getTaskWorkflow(db, scope)).toMatchObject({
      status: 200,
      data: { owner: "jasper", source: "gtd-default", stages: GTD_TASK_STAGES },
    });
  });

  it("stores workflows per person and allows teammates to view them", async () => {
    const stages = [
      { id: "ready", label: "Ready", color: "#112233" },
      { id: "shipped", label: "Shipped", color: "#445566", completed: true },
    ];
    expect(await putTaskWorkflow(db, scope, "jasper", { stages })).toMatchObject({ status: 200, data: { source: "custom", stages } });
    expect(await getTaskWorkflow(db, { ...scope, userLogin: "alex" }, "jasper")).toMatchObject({ status: 200, data: { owner: "jasper", stages } });
    expect((await getTaskWorkflow(db, scope, "alex")).data).toMatchObject({ source: "gtd-default" });
  });

  it("only lets a person change their own personal workflow", async () => {
    const stages = [
      { id: "ready", label: "Ready", color: "#112233" },
      { id: "done", label: "Done", color: "#445566", completed: true },
    ];
    expect(await putTaskWorkflow(db, scope, "alex", { stages })).toMatchObject({ status: 403 });
    expect(await putTaskWorkflow(db, { ...scope, isAdmin: true }, "alex", { stages })).toMatchObject({ status: 403 });
    expect(await putTaskWorkflow(db, { ...scope, userLogin: "alex" }, "alex", { stages })).toMatchObject({ status: 200 });
  });

  it("rehomes orphaned tasks and keeps completed tasks in the completion stage", async () => {
    await createTask(db, scope, { title: "Legacy open", stageId: "todo" });
    const completed = await createTask(db, scope, { title: "Completed", stageId: "done" });
    await updateTask(db, scope, (completed.data as { id: string }).id, { status: "completed" });
    const stages = [
      { id: "capture", label: "Capture", color: "#112233" },
      { id: "finished", label: "Finished", color: "#445566", completed: true },
    ];
    await putTaskWorkflow(db, scope, "jasper", { stages });
    expect((await listTasks(db, scope)).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Legacy open", stageId: "capture", status: "open" }),
      expect.objectContaining({ title: "Completed", stageId: "finished", status: "completed" }),
    ]));
  });

  it("rejects duplicate stages and workflows without one completion stage", async () => {
    expect(await putTaskWorkflow(db, scope, "jasper", { stages: [
      { id: "same", label: "One", color: "#112233" },
      { id: "same", label: "Two", color: "#445566", completed: true },
    ] })).toMatchObject({ status: 422 });
    expect(await putTaskWorkflow(db, scope, "jasper", { stages: [
      { id: "one", label: "One", color: "#112233" },
      { id: "two", label: "Two", color: "#445566" },
    ] })).toMatchObject({ status: 422 });
  });
});
