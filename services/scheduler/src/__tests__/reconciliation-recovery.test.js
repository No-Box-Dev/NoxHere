import { describe, expect, it, vi } from "vitest";

import {
  RECONCILE_ABANDONED_AFTER_MINUTES,
  recoverAbandonedReconciliations,
} from "../reconciliation-recovery.js";

function makeEnv({ pending = [], markedChanges = 0, sendError = null } = {}) {
  const state = { finalUpdateBinds: null, cutoff: null };
  const DB = {
    prepare(sql) {
      return {
        _binds: [],
        bind(...binds) { this._binds = binds; return this; },
        async all() {
          if (sql.includes("FROM reconcile_runs rr")) return { results: pending };
          return { results: [] };
        },
        async run() {
          if (sql.includes("finished_at IS NULL AND started_at <= ?")) {
            state.cutoff = this._binds[1];
            return { meta: { changes: markedChanges } };
          }
          if (sql.includes("recovery_enqueued_at =")) {
            state.finalUpdateBinds = this._binds;
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  };
  const TASK_QUEUE = {
    sendBatch: sendError
      ? vi.fn().mockRejectedValue(sendError)
      : vi.fn().mockResolvedValue(undefined),
  };
  return { env: { DB, TASK_QUEUE }, state };
}

describe("reconciliation recovery", () => {
  it("closes expired runs and durably requeues one task per organization", async () => {
    const nowMs = Date.parse("2026-10-13T15:00:00.000Z");
    const { env, state } = makeEnv({
      markedChanges: 2,
      pending: [
        { run_id: 10, org_id: 1, github_login: "acme", installation_id: 101 },
        { run_id: 11, org_id: 1, github_login: "acme", installation_id: 101 },
        { run_id: 12, org_id: 2, github_login: "n1", installation_id: 202 },
      ],
    });

    await expect(recoverAbandonedReconciliations(env, nowMs)).resolves.toEqual({
      abandoned: 2,
      requeued: 2,
    });

    expect(state.cutoff).toBe(new Date(
      nowMs - RECONCILE_ABANDONED_AFTER_MINUTES * 60 * 1000,
    ).toISOString());
    expect(env.TASK_QUEUE.sendBatch).toHaveBeenCalledWith([
      { body: expect.objectContaining({
        type: "reconcile_org",
        orgId: 1,
        deliveryId: "reconcile-recovery:1:11:1791903600000",
      }) },
      { body: expect.objectContaining({
        type: "reconcile_org",
        orgId: 2,
        deliveryId: "reconcile-recovery:2:12:1791903600000",
      }) },
    ]);
    expect(state.finalUpdateBinds).toEqual([
      10,
      11,
      12,
      "reconcile_abandoned_pending_recovery",
    ]);
  });

  it("leaves recovery pending when Queue publication fails", async () => {
    const { env, state } = makeEnv({
      markedChanges: 1,
      pending: [{ run_id: 9, org_id: 3, github_login: "retry", installation_id: 303 }],
      sendError: new Error("queue unavailable"),
    });

    await expect(recoverAbandonedReconciliations(env)).rejects.toThrow("queue unavailable");
    expect(state.finalUpdateBinds).toBeNull();
  });

  it("does not publish when there is no recoverable organization", async () => {
    const { env } = makeEnv({ markedChanges: 0, pending: [] });

    await expect(recoverAbandonedReconciliations(env)).resolves.toEqual({
      abandoned: 0,
      requeued: 0,
    });
    expect(env.TASK_QUEUE.sendBatch).not.toHaveBeenCalled();
  });
});
