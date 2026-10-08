import { describe, expect, it, vi } from "vitest";
import { cueTrackedEventSchema, handleCueEvent } from "../events";

const protectedUser = "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40";

function environment(kind: "publishable" | "secret" = "publishable") {
  const prepare = vi.fn((sql: string) => {
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn(async () => sql.includes("FROM cue_source_keys") ? {
        key_id: "key-1", key_kind: kind, org_id: 7, owner_id: "acme",
        source_id: "source-1", source_name: "N1 Website", project_id: "n1",
        allowed_origins_json: '["https://n1.care","https://www.n1.care"]',
        allowed_events_json: '["website.demo_clicked","website.page_visited"]',
        timezone: "UTC", error_cooldown_minutes: 15, environment: "production",
        alerts_enabled: 0, aggregate_only_slack: 1,
        slack_channel_id: null, slack_connection_id: null,
      } : null),
      run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    };
    return statement;
  });
  const allow = { limit: vi.fn(async () => ({ success: true })) };
  return {
    env: {
      NOX_DB: { prepare, batch: vi.fn() }, NOX_TASKS: { send: vi.fn() },
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env,
    prepare,
  };
}

function request(body: object, key = `nox_pub_${"a".repeat(43)}`, origin = "https://n1.care") {
  return new Request("https://api.noxhere.com/v1/events", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "X-Nox-Ingest-Key": key },
    body: JSON.stringify(body),
  });
}

describe("anonymous browser activity", () => {
  it("accepts an allowlisted count-only event", async () => {
    const { env, prepare } = environment();
    const response = await handleCueEvent(request({
      type: "activity.tracked", eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      name: "website.demo_clicked", value: 1,
    }), env);
    expect(response.status).toBe(202);
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes("cue_tracked_events"))).toBe(true);
  });

  it("rejects identity and unregistered browser events", async () => {
    const withIdentity = await handleCueEvent(request({
      type: "activity.tracked", eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      name: "website.demo_clicked", value: 1, userId: protectedUser,
    }), environment().env);
    expect(withIdentity.status).toBe(403);

    const unknown = await handleCueEvent(request({
      type: "activity.tracked", eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      name: "website.unknown_clicked", value: 1,
    }), environment().env);
    expect(unknown.status).toBe(403);
  });

  it("rejects a server secret presented by a browser", async () => {
    const response = await handleCueEvent(request({
      type: "activity.tracked", eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      name: "website.demo_clicked", value: 1,
    }, `nox_secret_${"a".repeat(43)}`), environment("secret").env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "secret_key_not_allowed_from_browser" });
  });

  it("keeps the tracked schema count-only when identity is absent", () => {
    expect(cueTrackedEventSchema.safeParse({
      type: "activity.tracked", eventId: crypto.randomUUID(), name: "website.page_visited", value: 1,
    }).success).toBe(true);
  });
});
