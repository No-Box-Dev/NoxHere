import { describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestPost } from "../tasks";
import { onRequestDelete, onRequestPatch } from "../tasks/[id]";

const task = { id: "11111111-1111-4111-8111-111111111111", title: "Write tests", owner: "jasper", color: "gray", status: "open", featureNumber: null, stageId: "todo" };
function service() {
  return {
    listTasks: vi.fn(async () => ({ ok: true, status: 200, data: [task] })),
    createTask: vi.fn(async () => ({ ok: true, status: 201, data: task })),
    updateTask: vi.fn(async () => ({ ok: true, status: 200, data: task })),
    deleteTask: vi.fn(async () => ({ ok: true, status: 200, data: { ok: true } })),
  };
}
function context({ binding = service(), url = "https://app.noxhere.com/api/v1/tasks", method = "GET", body, id }: { binding?: ReturnType<typeof service>; url?: string; method?: string; body?: unknown; id?: string } = {}) {
  return {
    binding,
    env: { NOXTICKET_SERVICE: binding as never },
    data: { orgId: 1, projectId: "project-1", userLogin: "jasper", isAdmin: false },
    request: new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) }),
    params: { id },
  };
}
const scope = { orgId: 1, projectId: "project-1", userLogin: "jasper", isAdmin: false };

describe("Planning task API", () => {
  it("passes list filters to NoxTicket", async () => {
    const ctx = context({ url: "https://app.noxhere.com/api/v1/tasks?owner=alex&status=open&featureNumber=12" });
    expect((await onRequestGet(ctx)).status).toBe(200);
    expect(ctx.binding.listTasks).toHaveBeenCalledWith(scope, { owner: "alex", status: "open", featureNumber: 12 });
  });

  it("creates, updates, and deletes through the service binding", async () => {
    const create = context({ method: "POST", body: { title: "Write tests" } });
    expect((await onRequestPost(create)).status).toBe(201);
    expect(create.binding.createTask).toHaveBeenCalledWith(scope, { title: "Write tests" });
    const update = context({ method: "PATCH", id: task.id, body: { status: "completed" } });
    expect((await onRequestPatch(update)).status).toBe(200);
    expect(update.binding.updateTask).toHaveBeenCalledWith(scope, task.id, { status: "completed" });
    const remove = context({ method: "DELETE", id: task.id });
    expect((await onRequestDelete(remove)).status).toBe(200);
    expect(remove.binding.deleteTask).toHaveBeenCalledWith(scope, task.id);
  });

  it("rejects malformed query parameters before RPC", async () => {
    const ctx = context({ url: "https://app.noxhere.com/api/v1/tasks?featureNumber=nope" });
    expect((await onRequestGet(ctx)).status).toBe(400);
    expect(ctx.binding.listTasks).not.toHaveBeenCalled();
  });
});
