import { describe, expect, it, vi } from "vitest";
import { cueFeatureResultSchema, storeFeatureResult } from "../feature-health";
import { standardFeature } from "../feature-catalog";

function featureEnv(previous: Record<string, unknown> | null) {
  const bindings: Array<{ sql: string; values: unknown[] }> = [];
  const queue = { send: vi.fn(async () => undefined) };
  const prepare = vi.fn((sql: string) => {
    const statement = {
      bind: vi.fn((...values: unknown[]) => {
        bindings.push({ sql, values });
        return statement;
      }),
      first: vi.fn(async () => sql.includes("FROM cue_feature_states") ? previous : null),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    };
    return statement;
  });
  return {
    env: { NOX_DB: { prepare }, NOX_TASKS: queue } as unknown as Env,
    queue,
    bindings,
  };
}

const source = {
  org_id: 7,
  owner_id: "acme",
  source_id: "source-1",
  source_name: "Playnist",
  slack_channel_id: "C123",
  slack_connection_id: "conn-1",
};
const signup = standardFeature("auth.signup")!;

describe("critical feature incidents", () => {
  it("opens and queues an incident on the first system failure", async () => {
    const { env, queue, bindings } = featureEnv({
      status: "healthy", consecutive_failures: 0, consecutive_successes: 0,
      incident_started_at: null, last_reason: null,
    });
    const event = cueFeatureResultSchema.parse({
      type: "feature.result", feature: "auth.signup", outcome: "failure",
      reason: "dependency_unavailable",
      error: { name: "AuthApiError", message: "Authentication service unavailable", status: 503 },
    });

    const result = await storeFeatureResult(env, source, event, "11111111-1111-4111-8111-111111111111", signup);

    expect(result).toMatchObject({ status: "issue", queued: true, duplicate: false });
    expect(queue.send).toHaveBeenCalledOnce();
    const outbox = bindings.find(({ sql }) => sql.includes("INSERT OR IGNORE INTO delivery_outbox"));
    expect(outbox?.values).toContain("feature:source-1:auth.signup:incident:11111111-1111-4111-8111-111111111111");
    expect(JSON.stringify(outbox?.values)).toContain("A user was prevented from signing up");
    expect(JSON.stringify(outbox?.values)).toContain("Authentication service unavailable");
  });

  it("queues every subsequent system failure as a distinct incident", async () => {
    const { env, queue } = featureEnv({
      status: "issue", consecutive_failures: 1, consecutive_successes: 0,
      incident_started_at: "2026-08-30T01:00:00.000Z", last_reason: "dependency_unavailable",
    });
    const event = cueFeatureResultSchema.parse({
      type: "feature.result", feature: "auth.signup", outcome: "failure", reason: "timeout",
      error: { message: "Request timed out", code: "AUTH_TIMEOUT" },
    });

    const result = await storeFeatureResult(env, source, event, "22222222-2222-4222-8222-222222222222", signup);

    expect(result).toMatchObject({ status: "issue", queued: true });
    expect(queue.send).toHaveBeenCalledOnce();
  });

  it("records later success without resolving or posting recovery", async () => {
    const { env, queue } = featureEnv({
      status: "issue", consecutive_failures: 1, consecutive_successes: 0,
      incident_started_at: "2026-08-30T01:00:00.000Z", last_reason: "dependency_unavailable",
    });
    const event = cueFeatureResultSchema.parse({
      type: "feature.result", feature: "auth.signup", outcome: "success",
    });

    const result = await storeFeatureResult(env, source, event, "33333333-3333-4333-8333-333333333333", signup);

    expect(result).toMatchObject({ status: "issue", queued: false });
    expect(queue.send).not.toHaveBeenCalled();
  });
});
