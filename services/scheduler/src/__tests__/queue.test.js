import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the cross-package helpers the queue consumer dispatches to.
vi.mock("../reconcile.js", () => ({ reconcileOrg: vi.fn() }));
vi.mock("../../../../functions/lib/narrator.js", () => ({ narrateEvent: vi.fn() }));
vi.mock("../../../../functions/lib/github-sync.js", () => ({
  bootstrapInstallation: vi.fn(),
  syncRepo: vi.fn(),
}));
vi.mock("../../../../functions/lib/github-app.js", () => ({
  getInstallationToken: vi.fn().mockResolvedValue("install-token"),
}));
vi.mock("../../../../functions/lib/op-failures.js", () => ({ recordFailure: vi.fn() }));
vi.mock("../../../../functions/lib/task-quarantine.js", () => ({ quarantineTask: vi.fn() }));
vi.mock("../../../../functions/lib/feedback.js", () => ({
  createFeedbackGitHubIssue: vi.fn(),
}));
vi.mock("../../../../functions/lib/feedback-resolution.js", () => ({
  recoverFeedbackResolutionPreparations: vi.fn(),
  recoverFeedbackResolutionEmails: vi.fn(),
}));
vi.mock("../../../../functions/lib/telemetry-github.js", () => ({
  createOrUpdateTelemetryGitHubIssue: vi.fn(), recoverTelemetryGithubIncidents: vi.fn(),
}));
vi.mock("../../../../functions/lib/delivery-outbox.js", () => ({
  markOutboxFailed: vi.fn(), recoverOutboxDeliveries: vi.fn(), requeueBlockedForOrg: vi.fn(),
}));

import worker from "../index.js";
import { reconcileOrg } from "../reconcile.js";
import { narrateEvent } from "../../../../functions/lib/narrator.js";
import { syncRepo } from "../../../../functions/lib/github-sync.js";
import { getInstallationToken } from "../../../../functions/lib/github-app.js";
import { recordFailure } from "../../../../functions/lib/op-failures.js";
import { quarantineTask } from "../../../../functions/lib/task-quarantine.js";
import { createFeedbackGitHubIssue } from "../../../../functions/lib/feedback.js";
import { createOrUpdateTelemetryGitHubIssue } from "../../../../functions/lib/telemetry-github.js";
import { markOutboxFailed } from "../../../../functions/lib/delivery-outbox.js";

const connections = {
  deliverFeedbackResolutionEmail: vi.fn(),
  prepareFeedbackResolutionEmail: vi.fn(),
  deliverSlackOutbox: vi.fn(),
  deliverTransport: vi.fn(),
};
const env = { DB: {}, NOXHERE: connections };

function msg(body, attempts = 1) {
  return { body, attempts, ack: vi.fn(), retry: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());

describe("background queue consumer", () => {
  it("dispatches a narrate task and acks", async () => {
    const m = msg({ type: "narrate", eventId: 7 });
    await worker.queue({ messages: [m] }, env);
    expect(narrateEvent).toHaveBeenCalledWith(env, 7);
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
  });

  it("resolves an install token before running sync_repo", async () => {
    const m = msg({ type: "sync_repo", orgId: 1, accountLogin: "acme", installationId: 100, repo: "api" });
    await worker.queue({ messages: [m] }, env);
    expect(getInstallationToken).toHaveBeenCalledWith(env, 100);
    expect(syncRepo).toHaveBeenCalledWith(env.DB, "install-token", 1, "acme", "api", true);
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("runs one organization reconciliation as a durable queue task", async () => {
    const task = { type: "reconcile_org", orgId: 7, accountLogin: "acme", installationId: 100 };
    const m = msg(task);
    await worker.queue({ messages: [m] }, env);
    expect(reconcileOrg).toHaveBeenCalledWith(env, env.DB, 7, "acme", 100);
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("routes Feedback captures through NoxHere's GitHub worker", async () => {
    const capture = { type: "spot_create_github_issue", captureId: "spot-1" };
    const m = msg(capture);
    await worker.queue({ messages: [m] }, env);
    expect(createFeedbackGitHubIssue).toHaveBeenCalledWith(env, capture);
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("routes Feedback resolution preparation through the durable worker", async () => {
    const task = { type: "spot_prepare_resolution_email", reportId: "spot-1" };
    const m = msg(task);
    await worker.queue({ messages: [m] }, env);
    expect(connections.prepareFeedbackResolutionEmail).toHaveBeenCalledWith("spot-1");
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("routes a durable Telemetry incident through the GitHub worker", async () => {
    const task = { type: "telemetry_github_issue", incidentId: "incident-1" };
    const m = msg(task);
    await worker.queue({ messages: [m] }, env);
    expect(createOrUpdateTelemetryGitHubIssue).toHaveBeenCalledWith(env, task);
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("routes Slack notifications through the durable outbox worker", async () => {
    const task = { type: "deliver_slack", outboxId: "delivery-1" };
    const m = msg(task);
    await worker.queue({ messages: [m] }, env);
    expect(connections.deliverSlackOutbox).toHaveBeenCalledWith("delivery-1");
    expect(m.ack).toHaveBeenCalledOnce();
  });

  it("retries (does not ack) a failing task before the delivery limit", async () => {
    narrateEvent.mockRejectedValueOnce(new Error("boom"));
    const m = msg({ type: "narrate", eventId: 1 }, 1);
    await worker.queue({ messages: [m] }, env);
    expect(m.retry).toHaveBeenCalledOnce();
    expect(m.ack).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("records and quarantines work before handing the final delivery to the DLQ", async () => {
    narrateEvent.mockRejectedValueOnce(new Error("boom"));
    // MAX_DELIVERIES = 5 (1 initial + max_retries 4); the 5th delivery is terminal.
    const m = msg({ type: "narrate", eventId: 1, ownerId: "acme", deliveryId: "d-1" }, 5);
    await worker.queue({ messages: [m] }, env);
    expect(recordFailure).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ ownerId: "acme", op: "task:narrate", deliveryId: "d-1" }),
    );
    expect(quarantineTask).toHaveBeenCalledWith(env.DB, m.body, 5, expect.any(Error));
    expect(m.ack).not.toHaveBeenCalled();
    expect(m.retry).toHaveBeenCalledOnce();
  });

  it("marks an exhausted Slack outbox delivery as failed", async () => {
    connections.deliverSlackOutbox.mockRejectedValueOnce(new Error("Slack unavailable"));
    const m = msg({ type: "deliver_slack", outboxId: "delivery-1", ownerId: "acme" }, 5);
    await worker.queue({ messages: [m] }, env);
    expect(markOutboxFailed).toHaveBeenCalledWith(env.DB, "delivery-1", expect.any(Error));
    expect(m.ack).not.toHaveBeenCalled();
    expect(m.retry).toHaveBeenCalledOnce();
  });

  it("treats an unknown task type as a failure", async () => {
    const m = msg({ type: "nope" }, 1);
    await worker.queue({ messages: [m] }, env);
    expect(m.retry).toHaveBeenCalledOnce();
  });
});
