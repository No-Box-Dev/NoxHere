import { describe, expect, it, vi } from "vitest";

vi.mock("../noxticket-slack.js", () => ({ stageNoxTicketFeatureAdded: vi.fn(async () => ({ queued: true })) }));
vi.mock("../op-failures.js", () => ({ recordFailure: vi.fn(async () => {}) }));

import { delegateFeatureMutation } from "../noxticket-features";
import { stageNoxTicketFeatureAdded } from "../noxticket-slack.js";
import { recordFailure } from "../op-failures.js";

const scope = { orgId: 2, projectId: "project-playnist", userLogin: "jasper" };

describe("NoxTicket feature delegation", () => {
  it("stages a Slack delivery after creating a project-owned feature", async () => {
    const feature = { number: 4, title: "Sharing", description: "Share a playlist", backlog: true };
    const createFeature = vi.fn(async () => ({ ok: true, status: 201, data: feature }));
    const response = await delegateFeatureMutation(
      { NOXTICKET_SERVICE: { createFeature } as never, DB: {} as D1Database, TASK_QUEUE: {} as Queue },
      scope,
      new Request("https://app.noxhere.com/api/v1/features", { method: "POST" }),
      "create",
      undefined,
      { title: "Sharing", description: "Share a playlist", backlog: true },
      "no-box-dev",
    );

    expect(stageNoxTicketFeatureAdded).toHaveBeenCalledWith(expect.anything(), {
      orgId: 2,
      projectId: "project-playnist",
      ownerId: "no-box-dev",
      actor: "jasper",
      feature,
    });
    await expect(response?.json()).resolves.toEqual(feature);
  });

  it("updates a project-owned feature directly in the Planning service", async () => {
    const updateFeature = vi.fn(async () => ({ ok: true, status: 200, data: { number: 1, status: "specced" } }));
    const response = await delegateFeatureMutation(
      { NOXTICKET_SERVICE: { updateFeature } as never },
      scope,
      new Request("https://app.noxhere.com/api/v1/features/1", { method: "PATCH" }),
      "update",
      1,
      { status: "specced" },
    );

    expect(updateFeature).toHaveBeenCalledWith(scope, 1, { status: "specced" });
    await expect(response?.json()).resolves.toMatchObject({ number: 1, status: "specced" });
  });

  it("records a feature notification failure without failing feature creation", async () => {
    const feature = { number: 14, title: "Backlog alert", backlog: true };
    const createFeature = vi.fn(async () => ({ ok: true, status: 201, data: feature }));
    vi.mocked(stageNoxTicketFeatureAdded).mockRejectedValueOnce(new Error("RPC receiver is missing the message builder"));

    const response = await delegateFeatureMutation(
      { NOXTICKET_SERVICE: { createFeature } as never, DB: {} as D1Database, TASK_QUEUE: {} as Queue },
      scope,
      new Request("https://app.noxhere.com/api/v1/features", { method: "POST" }),
      "create",
      undefined,
      { title: "Backlog alert", backlog: true },
      "no-box-dev",
    );

    await expect(response?.json()).resolves.toEqual(feature);
    expect(recordFailure).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      ownerId: "no-box-dev",
      op: "noxticket_feature_added_delivery",
      deliveryId: "project-playnist:14:created",
    }));
  });

  it("closes a feature through the same project-scoped service record", async () => {
    const updateFeature = vi.fn(async () => ({ ok: true, status: 200, data: { number: 1, state: "closed" } }));
    const response = await delegateFeatureMutation(
      { NOXTICKET_SERVICE: { updateFeature } as never },
      scope,
      new Request("https://app.noxhere.com/api/v1/features/1", { method: "DELETE" }),
      "close",
      1,
    );

    expect(updateFeature).toHaveBeenCalledWith(scope, 1, { state: "closed" });
    await expect(response?.json()).resolves.toEqual({ ok: true });
  });
});
