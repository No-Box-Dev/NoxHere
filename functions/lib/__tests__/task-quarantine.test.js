import { describe, expect, it, vi } from "vitest";
import { quarantineTask, requeueQuarantinedTask } from "../task-quarantine.js";

function statement(result = {}) {
  const value = { bind: vi.fn(() => value), run: vi.fn(async () => result), first: vi.fn(async () => result) };
  return value;
}

describe("task quarantine", () => {
  it("persists bounded retry evidence without credentials", async () => {
    const query = statement();
    const db = { prepare: vi.fn(() => query) };
    await quarantineTask(db, { type: "sync_repo", ownerId: "acme", deliveryId: "d-1", repo: "api" }, 5, new Error("boom"));
    expect(query.bind).toHaveBeenCalledWith(
      "sync_repo:d-1", "acme", "d-1", "sync_repo",
      expect.stringContaining('"repo":"api"'), 5, expect.stringContaining("boom"),
    );
  });

  it("refuses credential-shaped task payloads", async () => {
    await expect(quarantineTask({ prepare: vi.fn() }, { type: "sync_repo", accessToken: "secret" }, 5, new Error("boom")))
      .rejects.toThrow("credential_field_forbidden");
  });

  it("claims a quarantined task once and marks it requeued after publish", async () => {
    const claim = statement({ id: 4, payload_json: '{"type":"narrate","eventId":7}' });
    const complete = statement();
    const db = { prepare: vi.fn((sql) => sql.includes("RETURNING") ? claim : complete) };
    const queue = { send: vi.fn(async () => undefined) };
    await expect(requeueQuarantinedTask(db, queue, "acme", 4)).resolves.toEqual({ status: "requeued", id: 4 });
    expect(queue.send).toHaveBeenCalledWith({ type: "narrate", eventId: 7 });
  });
});
