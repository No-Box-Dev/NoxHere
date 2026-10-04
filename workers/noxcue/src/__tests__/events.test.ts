import { describe, expect, it, vi } from "vitest";
import {
  buildCueSlackMessage,
  cueErrorEventSchema,
  cueActivityEventSchema,
  cueEventSchema,
  cueUserActiveEventSchema,
  cueUserRegisteredEventSchema,
  handleCueEvent,
} from "../events";
import { cueFeatureResultSchema } from "../feature-health";

describe("NoxCue event contract", () => {
  it("accepts bounded structured error diagnostics", () => {
    const parsed = cueErrorEventSchema.parse({
      type: "error.occurred",
      title: "Widget failed",
      data: {
        attributes: {
          "runtime.browser": "Chrome",
          "renderer.svgCharacters": 2_400_000,
          "page.online": true,
          "resources.recent[0].origin": "https://cdn.example",
        },
      },
    });
    expect(parsed.data.attributes?.["runtime.browser"]).toBe("Chrome");
  });

  it("rejects unbounded or nested error diagnostics", () => {
    expect(cueErrorEventSchema.safeParse({
      type: "error.occurred",
      title: "Widget failed",
      data: { attributes: { nested: { secret: "no" } } },
    }).success).toBe(false);
    expect(cueErrorEventSchema.safeParse({
      type: "error.occurred",
      title: "Widget failed",
      data: { attributes: Object.fromEntries(Array.from({ length: 97 }, (_, i) => [`item.${i}`, i])) },
    }).success).toBe(false);
  });

  it("accepts explicit errors and only the closed user lifecycle events", () => {
    expect(cueErrorEventSchema.parse({
      type: "error.occurred",
      title: "Payment failed",
      data: { errorCode: "CARD_DECLINED", component: "checkout" },
    })).toMatchObject({ version: 1, level: "error" });
    expect(cueUserRegisteredEventSchema.parse({
      type: "user.registered",
      userId: "user-7",
      occurredAt: "2026-08-29T02:00:00Z",
      context: { environment: "production", release: "playnist@abc123", runtime: "server", sdkVersion: "0.1.1" },
    })).toMatchObject({
      type: "user.registered",
      userId: "user-7",
      context: { release: "playnist@abc123", sdkVersion: "0.1.1" },
    });
    expect(cueUserActiveEventSchema.parse({ type: "user.active", userId: "user-7" }))
      .toMatchObject({ type: "user.active", userId: "user-7" });
  });

  it("rejects telemetry, aggregate snapshots, arbitrary events, and unknown fields", () => {
    expect(cueEventSchema.safeParse({ type: "logs", title: "Batch", data: { records: [] } }).success).toBe(false);
    expect(cueEventSchema.safeParse({ type: "stats.daily", period: "2026-08-29", metrics: { "users.new": 3 } }).success).toBe(false);
    expect(cueEventSchema.safeParse({ type: "user.did_something", userId: "user-7" }).success).toBe(false);
    expect(cueEventSchema.safeParse({ type: "user.active", userId: "user-7", page: "/home" }).success).toBe(false);
  });

  it("accepts bounded feature names and requires the actual error for failures", () => {
    expect(cueFeatureResultSchema.parse({
      type: "feature.result", feature: "auth.password_reset", outcome: "failure",
      reason: "email_delivery_failed", durationMs: 842,
      message: "Mail provider timed out", error: { name: "EmailError", message: "Mail provider timed out", code: "MAIL_503", status: 503 },
      context: { environment: "production", release: "app@abc123", runtime: "server" },
    })).toMatchObject({ version: 1, feature: "auth.password_reset", test: false, context: { release: "app@abc123" } });
    expect(cueFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", email: "person@example.com",
    }).success).toBe(false);
    expect(cueFeatureResultSchema.safeParse({
      type: "feature.result", feature: "custom.journal.publish", outcome: "success",
    }).success).toBe(true);
    expect(cueFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", reason: "provider_raw_message",
    }).success).toBe(false);
    expect(cueFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", reason: "internal_error",
    }).success).toBe(false);
  });

  it("accepts only registered-shape custom activity events with an idempotent event ID", () => {
    expect(cueActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "custom.journals.added", userId: "user-7",
      eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      context: { environment: "production", release: "playnist@abc123", runtime: "server", sdkVersion: "0.1.1" },
    }).success).toBe(true);
    expect(cueActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "journals.added", userId: "user-7",
      eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
    }).success).toBe(false);
    expect(cueActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "custom.journals.added", userId: "user-7",
    }).success).toBe(false);
  });

  it("builds escaped Slack blocks", () => {
    const event = cueErrorEventSchema.parse({
      type: "error.occurred",
      title: "Payment <failed>",
      message: "Declined & stopped",
      url: "https://app.example.com/orders/1842",
      data: { errorCode: "CARD_<DECLINED>" },
    });
    const message = buildCueSlackMessage("Checkout & billing", event, 1);
    expect(message.text).toContain("Payment <failed>");
    expect(JSON.stringify(message.blocks)).toContain("Payment &lt;failed&gt;");
    expect(JSON.stringify(message.blocks)).toContain("Declined &amp; stopped");
  });

  it("stores an error and publishes NoxConnect's delivery task", async () => {
    const queue = { send: vi.fn(async () => undefined) };
    const batch = vi.fn(async () => []);
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => sql.includes("FROM cue_source_keys") ? {
          key_id: "key-1", key_kind: "publishable", org_id: 7, owner_id: "acme",
          source_id: "source-1", source_name: "Checkout", project_id: null,
          source_environment: "production",
          allowed_origins_json: '["https://app.example.com"]', timezone: "UTC",
          error_cooldown_minutes: 15, environment: "production", alerts_enabled: 1,
          slack_channel_id: "C123", slack_connection_id: "conn-1",
        } : null),
        run: vi.fn(async () => ({ success: true })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch }, NOX_TASKS: queue,
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleCueEvent(new Request("https://api.noxcue.dev/v1/events", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        "Content-Type": "application/json",
        "X-Nox-Ingest-Key": `nox_pub_${"a".repeat(43)}`,
      },
      body: JSON.stringify({ type: "error.occurred", title: "Payment failed", idempotencyKey: "attempt-1" }),
    }), env);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, stored: true, queued: true });
    const sourceLookup = prepare.mock.calls.find(([sql]) => String(sql).includes("FROM cue_source_keys"));
    expect(String(sourceLookup?.[0])).toContain("alert_route.route_key = 'noxcue_alerts'");
    expect(String(sourceLookup?.[0]).indexOf("NULLIF(alert_route.channel_id"))
      .toBeLessThan(String(sourceLookup?.[0]).indexOf("NULLIF(source.slack_channel_id"));
    expect(batch).toHaveBeenCalledOnce();
    expect(queue.send).toHaveBeenCalledWith(expect.objectContaining({ type: "deliver_slack" }));
  });

  it("rejects an event whose environment does not match the source key", async () => {
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => sql.includes("FROM cue_source_keys") ? {
          key_id: "key-1", key_kind: "secret", org_id: 7, owner_id: "acme",
          source_id: "source-1", source_name: "Playnist Production", project_id: "playnist",
          allowed_origins_json: "[]", timezone: "UTC", error_cooldown_minutes: 15,
          environment: "production", alerts_enabled: 1,
          slack_channel_id: "C123", slack_connection_id: "conn-1",
        } : null),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const batch = vi.fn(async () => []);
    const response = await handleCueEvent(new Request("https://api.noxcue.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({ type: "user.registered", environment: "staging", userId: "user-7" }),
    }), {
      NOX_DB: { prepare, batch }, NOX_TASKS: { send: vi.fn() },
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "environment_mismatch",
      expectedEnvironment: "production",
      receivedEnvironment: "staging",
    });
    expect(batch).not.toHaveBeenCalled();
  });

  it("stores an unknown feature as one unregistered error without creating a feature", async () => {
    const queue = { send: vi.fn(async () => undefined) };
    const batch = vi.fn(async () => []);
    const sqlSeen: string[] = [];
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => {
      sqlSeen.push(sql);
      const statement = {
        bind: vi.fn((...values: unknown[]) => { bindings.push(values); return statement; }),
        first: vi.fn(async () => {
          if (sql.includes("FROM cue_source_keys")) return {
            key_id: "key-1", key_kind: "publishable", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Playnist", project_id: "playnist",
            allowed_origins_json: '["https://app.example.com"]', timezone: "UTC",
            error_cooldown_minutes: 15, environment: "production", alerts_enabled: 1,
            slack_channel_id: "C123", slack_connection_id: "conn-1",
          };
          if (sql.includes("FROM cue_custom_features")) return null;
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch }, NOX_TASKS: queue,
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env;

    const response = await handleCueEvent(new Request("https://api.noxcue.dev/v1/events", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        "Content-Type": "application/json",
        "X-Nox-Ingest-Key": `nox_pub_${"a".repeat(43)}`,
      },
      body: JSON.stringify({
        type: "feature.result", feature: "journal.publish", outcome: "failure",
        message: "A user could not publish a journal.",
        error: { code: "DB_TIMEOUT", message: "Database request timed out" },
      }),
    }), env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      accepted: true,
      stored: true,
      classification: "unregistered",
      requestedFeature: "journal.publish",
    });
    expect(sqlSeen.some((sql) => sql.includes("INSERT INTO cue_feature_results"))).toBe(false);
    expect(JSON.stringify(bindings)).toContain("A user could not publish a journal");
    expect(JSON.stringify(bindings)).toContain("DB_TIMEOUT: Database request timed out");
    expect(batch).toHaveBeenCalledOnce();
    expect(queue.send).toHaveBeenCalledOnce();
  });

  it.each([
    ["user.registered", "cue_user_registrations"],
    ["user.active", "cue_user_active_days"],
  ])("hashes and deduplicates %s facts without storing the raw user ID", async (type, table) => {
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...values: unknown[]) => { bindings.push(values); return statement; }),
        first: vi.fn(async () => sql.includes("FROM cue_source_keys") ? {
          key_id: "key-1", key_kind: "secret", org_id: 7, owner_id: "acme",
          source_id: "source-1", source_name: "Playnist", project_id: null,
          source_environment: "production",
          allowed_origins_json: "[]", timezone: "UTC", error_cooldown_minutes: 15,
          environment: "production", alerts_enabled: 1,
          slack_channel_id: "C123", slack_connection_id: "conn-1",
        } : null),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const batch = vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true, meta: { changes: 1 } })));
    const env = {
      NOX_DB: { prepare, batch }, NOX_TASKS: { send: vi.fn() },
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleCueEvent(new Request("https://api.noxcue.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({ type, userId: "raw-user-7", occurredAt: "2026-08-29T02:00:00Z" }),
    }), env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, duplicate: false, period: "2026-08-29" });
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes(table))).toBe(true);
    if (type === "user.registered") {
      expect(prepare.mock.calls.some(([sql]) => String(sql).includes("cue_user_active_days"))).toBe(true);
      expect(batch).toHaveBeenCalledOnce();
    }
    const inserted = bindings.find((values) => values.includes("source-1") && values.includes("2026-08-29"));
    expect(inserted).toBeDefined();
    expect(inserted).not.toContain("raw-user-7");
  });

  it("stores a registered activity once without storing the raw user ID", async () => {
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...values: unknown[]) => { bindings.push(values); return statement; }),
        first: vi.fn(async () => {
          if (sql.includes("FROM cue_source_keys")) return {
            key_id: "key-1", key_kind: "secret", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Playnist", project_id: "playnist",
            allowed_origins_json: "[]", timezone: "UTC", error_cooldown_minutes: 15,
            environment: "production", alerts_enabled: 1,
            slack_channel_id: null, slack_connection_id: null,
          };
          if (sql.includes("FROM cue_custom_metrics")) return { label: "Journals added" };
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch: vi.fn() }, NOX_TASKS: { send: vi.fn() },
      CUE_IP_RATE_LIMITER: allow, CUE_ERROR_RATE_LIMITER: allow,
      CUE_USER_EVENT_RATE_LIMITER: allow, CUE_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleCueEvent(new Request("https://api.noxcue.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({
        type: "activity.occurred", metric: "custom.journals.added", userId: "raw-user-7",
        eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5", occurredAt: "2026-08-29T02:00:00Z",
      }),
    }), env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, duplicate: false, period: "2026-08-29" });
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes("INSERT OR IGNORE INTO cue_activity_events"))).toBe(true);
    const activityBindings = bindings.find((values) => values.includes("custom.journals.added") && values.includes("2026-08-29"));
    expect(activityBindings).toBeDefined();
    expect(activityBindings).not.toContain("raw-user-7");
  });
});
