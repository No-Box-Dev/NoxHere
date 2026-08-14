import { describe, expect, it } from "vitest";
import { buildSlackMessage, buildSlackPayload, canaryInputSchema, normalizeSlackPayload } from "../canary";

describe("NoxAlert canary", () => {
  it("builds a clearly synthetic Slack alert", () => {
    const message = buildSlackMessage(
      canaryInputSchema.parse({ service: "checkout", message: "Mock failure" }),
      "00000000-0000-4000-8000-000000000000",
    );
    expect(message).toContain("NoxAlert Canary — Synthetic Error");
    expect(message).toContain("Mock failure");
    expect(message).toContain("00000000-0000-4000-8000-000000000000");
  });

  it("escapes Slack control characters", () => {
    const message = buildSlackMessage(
      canaryInputSchema.parse({ service: "<checkout>", message: "A & B > C" }),
      "delivery-id",
    );
    expect(message).toContain("&lt;checkout&gt;");
    expect(message).toContain("A &amp; B &gt; C");
  });

  it("matches Unticket's shared delivery-outbox payload contract", () => {
    const payload = buildSlackPayload(
      canaryInputSchema.parse({ service: "checkout", message: "Mock failure" }),
      "delivery-id",
    );
    expect(payload).toEqual({
      message: {
        text: expect.stringContaining("Mock failure"),
      },
    });
  });

  it("upgrades the original canary payload for a safe retry", () => {
    expect(normalizeSlackPayload({ message: "Mock failure" })).toEqual({
      message: { text: "Mock failure" },
    });
    expect(normalizeSlackPayload({ message: { text: "Already valid", blocks: [] } })).toEqual({
      message: { text: "Already valid", blocks: [] },
    });
  });
});
