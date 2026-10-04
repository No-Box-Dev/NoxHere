import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../transport-outbox", () => ({
  publishSlackTransport: vi.fn(async () => ({ outboxId: "delivery-1", status: "queued", queued: true })),
}));
vi.mock("../inactive-repos.js", () => ({ getNoxTicketRepoName: vi.fn(async () => "noxconnect") }));
vi.mock("../apps.js", () => ({
  isAppEnabled: vi.fn(async () => true),
}));
vi.mock("../slack.js", () => ({
  resolveSlackChannels: vi.fn(async () => ({ fallbackChannelId: "C0", noxTicketChannelId: "CU" })),
  resolveSlackRoute: vi.fn((channels) => channels.noxTicketChannelId || channels.fallbackChannelId || ""),
  resolveSlackConnectionId: vi.fn((channels) => channels.noxTicketConnectionId || channels.fallbackConnectionId || ""),
}));

import { stageNoxTicketActivity, stageNoxTicketFeatureAdded } from "../noxticket-slack.js";
import { publishSlackTransport } from "../transport-outbox";
import { isAppEnabled } from "../apps.js";

const DB = {
  prepare: () => ({ bind() { return this; }, first: async () => ({ project_id: "project-1" }) }),
};

describe("NoxTicket Slack routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes ticket lifecycle activity to the NoxTicket channel", async () => {
    const buildFeatureAddedMessage = vi.fn(async () => ({ text: "New feature", blocks: [] }));
    await stageNoxTicketActivity(
      { DB, TASK_QUEUE: { send: vi.fn() }, NOXTICKET_SERVICE: { buildFeatureAddedMessage } },
      { orgId: 7, ownerId: "acme", repo: "noxconnect", action: "opened", actor: "ada", issue: { number: 9, title: "Ship alerts", body: "Notify everyone.\n<!-- noxticket:metadata\n{}\n-->", labels: [{ name: "backlog" }] } },
    );
    expect(buildFeatureAddedMessage).toHaveBeenCalledWith(expect.objectContaining({
      actor: "ada",
      feature: { number: 9, title: "Ship alerts", description: "Notify everyone.", backlog: true },
    }));
    expect(publishSlackTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      route: "feature_delivery", idempotencyKey: "noxticket:noxconnect:9:opened",
    }));
  });

  it("routes a native feature-added message to the project NoxTicket channel", async () => {
    const buildFeatureAddedMessage = vi.fn(async () => ({ text: "New feature", blocks: [] }));
    await stageNoxTicketFeatureAdded(
      { DB, TASK_QUEUE: { send: vi.fn() }, NOXTICKET_SERVICE: { buildFeatureAddedMessage } },
      { orgId: 7, projectId: "project-1", ownerId: "acme", actor: "ada", feature: { number: 12, title: "Ship alerts", description: "Notify the team", backlog: true } },
    );
    expect(buildFeatureAddedMessage).toHaveBeenCalledWith(expect.objectContaining({
      actor: "ada",
      projectId: "project-1",
      feature: expect.objectContaining({ title: "Ship alerts", description: "Notify the team", backlog: true }),
    }));
    expect(publishSlackTransport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      route: "feature_delivery", idempotencyKey: "noxticket:project-1:12:created", projectId: "project-1",
    }));
  });

  it("does not duplicate NoxSpot issues into NoxTicket", async () => {
    await stageNoxTicketActivity(
      { DB },
      { orgId: 7, ownerId: "acme", repo: "noxconnect", action: "opened", issue: { number: 9, labels: [{ name: "noxspot" }] } },
    );
    expect(publishSlackTransport).not.toHaveBeenCalled();
  });

  it("does nothing while NoxTicket is off", async () => {
    vi.mocked(isAppEnabled).mockResolvedValueOnce(false);
    const result = await stageNoxTicketActivity(
      { DB, TASK_QUEUE: { send: vi.fn() } },
      { orgId: 7, ownerId: "acme", repo: "noxconnect", action: "opened", issue: { number: 9, labels: [] } },
    );
    expect(result).toEqual({ skipped: "service_disabled" });
    expect(publishSlackTransport).not.toHaveBeenCalled();
  });
});
