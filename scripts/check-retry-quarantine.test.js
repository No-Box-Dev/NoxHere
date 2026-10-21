import { describe, expect, it } from "vitest";
import { verifyRetryQuarantinePolicy } from "./check-retry-quarantine.mjs";

describe("retry and quarantine release policy", () => {
  it("keeps auth, SDK, queue, DLQ, quarantine, and recovery bounds aligned", () => {
    expect(verifyRetryQuarantinePolicy()).toEqual({
      queueRetries: 4,
      maxDeliveries: 5,
      sdkRetryCap: 5,
      deviceAuthorizationMaxSeconds: 900,
    });
  });
});
