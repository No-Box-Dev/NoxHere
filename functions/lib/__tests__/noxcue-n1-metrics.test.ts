import { describe, expect, it } from "vitest";
import { calculateActivityConversion, calculateN1Metrics } from "../noxcue-n1-metrics";

describe("N1 metric calculations", () => {
  const events = [
    { name: "subscription.trial_started", subjectHash: "a" },
    { name: "subscription.trial_started", subjectHash: "b" },
    { name: "subscription.paid_started", subjectHash: "a" },
    { name: "subscription.cancelled", subjectHash: "a" },
    { name: "records.parsed", subjectHash: "a", value: 4 },
    { name: "records.parsed", subjectHash: "b", value: 2 },
    { name: "reports.generated", subjectHash: "a", value: 1 },
  ];

  it("calculates subscriptions, churn and count-valued activity", () => {
    expect(calculateN1Metrics(events)).toEqual({
      trialUsers: 2, paidUsers: 1, trialToPaid: 0.5,
      churnedUsers: 1, churnRate: 1, recordsParsed: 6, reportsGenerated: 1,
    });
  });

  it("calculates conversion between any two identified activities", () => {
    expect(calculateActivityConversion(events, "subscription.trial_started", "reports.generated")).toBe(0.5);
  });
});
