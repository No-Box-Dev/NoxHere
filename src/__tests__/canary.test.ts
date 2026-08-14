import { describe, expect, it } from "vitest";
import { buildSlackMessage, canaryInputSchema } from "../canary";

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
});
