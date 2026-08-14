import { z } from "zod";

export const alertRuleSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  orgId: z.number().int().positive(),
  projectId: z.string().min(1).nullable(),
  name: z.string().min(1).max(120),
  signal: z.enum(["logs", "metrics", "traces"]),
  comparator: z.enum(["above", "at_or_above", "below", "at_or_below"]),
  threshold: z.number().finite(),
  consecutiveBreaches: z.number().int().positive().max(60).default(1),
  consecutiveRecoveries: z.number().int().positive().max(60).default(1),
  repeatAfterSeconds: z.number().int().nonnegative().max(604_800).default(900),
});

export type AlertRule = z.infer<typeof alertRuleSchema>;

export const evaluationStateSchema = z.object({
  status: z.enum(["ok", "firing"]),
  breachCount: z.number().int().nonnegative(),
  recoveryCount: z.number().int().nonnegative(),
  lastNotifiedAt: z.number().int().nonnegative().nullable(),
});

export type EvaluationState = z.infer<typeof evaluationStateSchema>;

export interface EvaluationResult {
  state: EvaluationState;
  transition: "firing" | "repeated" | "resolved" | null;
}

export const INITIAL_EVALUATION_STATE: EvaluationState = {
  status: "ok",
  breachCount: 0,
  recoveryCount: 0,
  lastNotifiedAt: null,
};

function breached(rule: AlertRule, value: number): boolean {
  switch (rule.comparator) {
    case "above": return value > rule.threshold;
    case "at_or_above": return value >= rule.threshold;
    case "below": return value < rule.threshold;
    case "at_or_below": return value <= rule.threshold;
  }
}

/** Pure state transition used by every evaluator. Timestamps are Unix ms. */
export function evaluate(
  rule: AlertRule,
  previous: EvaluationState,
  value: number,
  evaluatedAt: number,
): EvaluationResult {
  if (!Number.isFinite(value)) throw new Error("Evaluation value must be finite");
  if (!Number.isSafeInteger(evaluatedAt) || evaluatedAt < 0) {
    throw new Error("Evaluation timestamp must be a non-negative Unix millisecond integer");
  }

  if (breached(rule, value)) {
    const breachCount = Math.min(previous.breachCount + 1, rule.consecutiveBreaches);
    if (previous.status === "ok" && breachCount >= rule.consecutiveBreaches) {
      return {
        transition: "firing",
        state: { status: "firing", breachCount, recoveryCount: 0, lastNotifiedAt: evaluatedAt },
      };
    }

    const mayRepeat = previous.status === "firing"
      && previous.lastNotifiedAt !== null
      && evaluatedAt - previous.lastNotifiedAt >= rule.repeatAfterSeconds * 1000;
    return {
      transition: mayRepeat ? "repeated" : null,
      state: {
        status: previous.status,
        breachCount,
        recoveryCount: 0,
        lastNotifiedAt: mayRepeat ? evaluatedAt : previous.lastNotifiedAt,
      },
    };
  }

  const recoveryCount = previous.recoveryCount + 1;
  if (previous.status === "firing" && recoveryCount >= rule.consecutiveRecoveries) {
    return {
      transition: "resolved",
      state: { ...INITIAL_EVALUATION_STATE },
    };
  }

  return {
    transition: null,
    state: {
      status: previous.status,
      breachCount: 0,
      recoveryCount: previous.status === "firing" ? recoveryCount : 0,
      lastNotifiedAt: previous.lastNotifiedAt,
    },
  };
}
