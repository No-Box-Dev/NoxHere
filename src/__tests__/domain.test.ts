import { describe, expect, it } from "vitest";
import { evaluate, INITIAL_EVALUATION_STATE, type AlertRule } from "../domain";

const rule: AlertRule = {
  id: "rule-1",
  ownerId: "No-Box-Dev",
  orgId: 1,
  projectId: null,
  name: "Error burst",
  signal: "logs",
  comparator: "at_or_above",
  threshold: 10,
  consecutiveBreaches: 2,
  consecutiveRecoveries: 2,
  repeatAfterSeconds: 900,
};

describe("evaluate", () => {
  it("fires only after the configured consecutive breaches", () => {
    const first = evaluate(rule, INITIAL_EVALUATION_STATE, 10, 1_000);
    expect(first.transition).toBeNull();
    const second = evaluate(rule, first.state, 12, 2_000);
    expect(second.transition).toBe("firing");
    expect(second.state.status).toBe("firing");
  });

  it("resolves only after the configured consecutive recoveries", () => {
    const firing = evaluate(rule, { ...INITIAL_EVALUATION_STATE, breachCount: 1 }, 12, 2_000);
    const first = evaluate(rule, firing.state, 0, 3_000);
    expect(first.transition).toBeNull();
    const second = evaluate(rule, first.state, 0, 4_000);
    expect(second.transition).toBe("resolved");
    expect(second.state).toEqual(INITIAL_EVALUATION_STATE);
  });

  it("repeats no faster than the notification interval", () => {
    const firing = evaluate(rule, { ...INITIAL_EVALUATION_STATE, breachCount: 1 }, 12, 2_000);
    expect(evaluate(rule, firing.state, 12, 901_000).transition).toBeNull();
    expect(evaluate(rule, firing.state, 12, 902_000).transition).toBe("repeated");
  });

  it("does not accumulate recovery state while already healthy", () => {
    expect(evaluate(rule, INITIAL_EVALUATION_STATE, 0, 1_000).state)
      .toEqual(INITIAL_EVALUATION_STATE);
  });

  it("rejects invalid timestamps", () => {
    expect(() => evaluate(rule, INITIAL_EVALUATION_STATE, 0, Number.NaN)).toThrow();
  });
});
