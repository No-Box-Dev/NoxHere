import { beforeEach, describe, expect, it, vi } from "vitest";

const { publishSlackTransport } = vi.hoisted(() => ({
  publishSlackTransport: vi.fn(),
}));

vi.mock("../../../../functions/lib/transport-outbox.ts", () => ({ publishSlackTransport }));

import { runOperationalAlerts } from "../operational-alerts.js";

function database({ failures = [], deliveries = [], transports = [] } = {}) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async all() {
          return { results: sql.includes("FROM op_failures")
            ? failures
            : sql.includes("FROM delivery_outbox") ? deliveries : transports };
        },
      };
    },
  };
}

describe("operational Slack alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishSlackTransport.mockResolvedValue({ outboxId: "alert-1", status: "queued", queued: true });
  });

  it("stages a retry-safe alert without putting credentials or URLs in Slack", async () => {
    const db = database({ failures: [{
      org_id: 7,
      project_id: "project-1",
      org_login: "acme",
      kind: "operation_failure",
      source_id: "op_failure:42",
      subject: "task:sync_repo",
      detail: "request failed with ghp_secret at https://api.github.com/repos/acme/private\nstack",
      occurred_at: "2026-09-09 08:00:00",
    }] });

    expect(await runOperationalAlerts({ DB: db, TASK_QUEUE: {} })).toEqual({ candidates: 1, queued: 1, skipped: 0 });
    expect(publishSlackTransport).toHaveBeenCalledWith(expect.objectContaining({ DB: db }), expect.objectContaining({
      route: "operations",
      idempotencyKey: "operations:op_failure:42",
    }));
    const payload = publishSlackTransport.mock.calls[0][1].message;
    expect(JSON.stringify(payload)).toContain("[credential removed]");
    expect(JSON.stringify(payload)).toContain("[url removed]");
    expect(JSON.stringify(payload)).not.toContain("ghp_secret");
  });

  it("leaves route resolution to the shared transport", async () => {
    const db = database({ deliveries: [{
      org_id: 7,
      project_id: "project-1",
      org_login: "acme",
      kind: "delivery_failure",
      source_id: "delivery_failure:d-1",
      subject: "noxspot",
      detail: "channel_not_found",
      occurred_at: "2026-09-09T08:00:00Z",
    }] });

    expect(await runOperationalAlerts({ DB: db })).toEqual({ candidates: 1, queued: 1, skipped: 0 });
    expect(publishSlackTransport).toHaveBeenCalledOnce();
  });

  it("alerts on failures from the unified Slack and GitHub transport", async () => {
    const db = database({ transports: [{
      org_id: 7,
      project_id: "project-1",
      org_login: "acme",
      kind: "transport_failure",
      source_id: "transport_failure:t-1",
      subject: "github.issue.create",
      detail: "provider rejected the command",
      occurred_at: "2026-09-09T08:00:00Z",
    }] });

    expect(await runOperationalAlerts({ DB: db })).toEqual({ candidates: 1, queued: 1, skipped: 0 });
    expect(publishSlackTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: "operations:transport_failure:t-1",
      route: "operations",
    }));
  });
});
