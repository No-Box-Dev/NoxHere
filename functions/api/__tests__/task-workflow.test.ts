import { describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestPut } from "../task-workflows";

const workflow = { owner: "jasper", source: "gtd-default", updatedAt: null, stages: [{ id: "inbox", label: "Inbox", color: "#94a3b8" }, { id: "done", label: "Done", color: "#6e9970", completed: true }] };
function service() {
  return {
    getTaskWorkflow: vi.fn(async () => ({ ok: true, status: 200, data: workflow })),
    putTaskWorkflow: vi.fn(async () => ({ ok: true, status: 200, data: { ...workflow, source: "custom" } })),
  };
}
function context({ method = "GET", url = "https://app.noxhere.com/api/v1/task-workflows", body }: { method?: string; url?: string; body?: unknown } = {}) {
  const binding = service();
  return {
    binding,
    env: { NOXTICKET_SERVICE: binding as never },
    data: { orgId: 1, projectId: "project-1", userLogin: "jasper", isAdmin: false },
    request: new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) }),
  };
}
const scope = { orgId: 1, projectId: "project-1", userLogin: "jasper", isAdmin: false };

describe("personal task workflow API", () => {
  it("loads the selected person's workflow", async () => {
    const ctx = context({ url: "https://app.noxhere.com/api/v1/task-workflows?owner=alex" });
    expect((await onRequestGet(ctx)).status).toBe(200);
    expect(ctx.binding.getTaskWorkflow).toHaveBeenCalledWith(scope, "alex");
  });

  it("saves the signed-in person's workflow", async () => {
    const ctx = context({ method: "PUT", body: { owner: "jasper", stages: workflow.stages } });
    expect((await onRequestPut(ctx)).status).toBe(200);
    expect(ctx.binding.putTaskWorkflow).toHaveBeenCalledWith(scope, "jasper", { stages: workflow.stages });
  });
});
