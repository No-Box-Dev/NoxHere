import { describe, expect, it, vi } from "vitest";
import {
  buildTelemetrySlackMessage,
  telemetryErrorEventSchema,
  telemetryActivityEventSchema,
  telemetryEventSchema,
  telemetryUserActiveEventSchema,
  telemetryUserRegisteredEventSchema,
  handleTelemetryEvent,
} from "../events";
import { telemetryFeatureResultSchema } from "../feature-health";

const PROTECTED_USER = "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40";

describe("Telemetry event contract", () => {
  it("accepts bounded structured error diagnostics", () => {
    const parsed = telemetryErrorEventSchema.parse({
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
    expect(telemetryErrorEventSchema.safeParse({
      type: "error.occurred",
      title: "Widget failed",
      data: { attributes: { nested: { secret: "no" } } },
    }).success).toBe(false);
    expect(telemetryErrorEventSchema.safeParse({
      type: "error.occurred",
      title: "Widget failed",
      data: { attributes: Object.fromEntries(Array.from({ length: 97 }, (_, i) => [`item.${i}`, i])) },
    }).success).toBe(false);
  });

  it("accepts explicit errors and only the closed user lifecycle events", () => {
    expect(telemetryErrorEventSchema.parse({
      type: "error.occurred",
      title: "Payment failed",
      data: { errorCode: "CARD_DECLINED", component: "checkout" },
    })).toMatchObject({ version: 1, level: "error" });
    expect(telemetryUserRegisteredEventSchema.parse({
      type: "user.registered",
      userId: PROTECTED_USER,
      occurredAt: "2026-08-29T02:00:00Z",
      context: { environment: "production", release: "playnist@abc123", runtime: "server", sdkVersion: "0.1.1" },
    })).toMatchObject({
      type: "user.registered",
      userId: PROTECTED_USER,
      context: { release: "playnist@abc123", sdkVersion: "0.1.1" },
    });
    expect(telemetryUserActiveEventSchema.parse({ type: "user.active", userId: PROTECTED_USER }))
      .toMatchObject({ type: "user.active", userId: PROTECTED_USER });
    expect(telemetryUserActiveEventSchema.safeParse({ type: "user.active", userId: "raw-user-7" }).success).toBe(false);
  });

  it("rejects telemetry, aggregate snapshots, arbitrary events, and unknown fields", () => {
    expect(telemetryEventSchema.safeParse({ type: "logs", title: "Batch", data: { records: [] } }).success).toBe(false);
    expect(telemetryEventSchema.safeParse({ type: "stats.daily", period: "2026-08-29", metrics: { "users.new": 3 } }).success).toBe(false);
    expect(telemetryEventSchema.safeParse({ type: "user.did_something", userId: "user-7" }).success).toBe(false);
    expect(telemetryEventSchema.safeParse({ type: "user.active", userId: "user-7", page: "/home" }).success).toBe(false);
  });

  it("accepts bounded feature names and requires the actual error for failures", () => {
    expect(telemetryFeatureResultSchema.parse({
      type: "feature.result", feature: "auth.password_reset", outcome: "failure",
      reason: "email_delivery_failed", durationMs: 842,
      message: "Mail provider timed out", error: { name: "EmailError", message: "Mail provider timed out", code: "MAIL_503", status: 503 },
      context: { environment: "production", release: "app@abc123", runtime: "server" },
    })).toMatchObject({ version: 1, feature: "auth.password_reset", test: false, context: { release: "app@abc123" } });
    expect(telemetryFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", email: "person@example.com",
    }).success).toBe(false);
    expect(telemetryFeatureResultSchema.safeParse({
      type: "feature.result", feature: "custom.journal.publish", outcome: "success",
    }).success).toBe(true);
    expect(telemetryFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", reason: "provider_raw_message",
    }).success).toBe(false);
    expect(telemetryFeatureResultSchema.safeParse({
      type: "feature.result", feature: "auth.login", outcome: "failure", reason: "internal_error",
    }).success).toBe(false);
  });

  it("accepts only registered-shape custom activity events with an idempotent event ID", () => {
    expect(telemetryActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "custom.journals.added", userId: PROTECTED_USER,
      eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
      context: { environment: "production", release: "playnist@abc123", runtime: "server", sdkVersion: "0.1.1" },
    }).success).toBe(true);
    expect(telemetryActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "journals.added", userId: PROTECTED_USER,
      eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5",
    }).success).toBe(false);
    expect(telemetryActivityEventSchema.safeParse({
      type: "activity.occurred", metric: "custom.journals.added", userId: PROTECTED_USER,
    }).success).toBe(false);
  });

  it("builds escaped Slack blocks", () => {
    const event = telemetryErrorEventSchema.parse({
      type: "error.occurred",
      title: "Payment <failed>",
      message: "Declined & stopped",
      url: "https://app.example.com/orders/1842",
      data: { errorCode: "CARD_<DECLINED>" },
    });
    const message = buildTelemetrySlackMessage("Checkout & billing", event, 1);
    expect(message.text).toContain("Payment <failed>");
    expect(JSON.stringify(message.blocks)).toContain("Payment &lt;failed&gt;");
    expect(JSON.stringify(message.blocks)).toContain("Declined &amp; stopped");
  });

  it("stores an error and publishes NoxHere's delivery task", async () => {
    const queue = { send: vi.fn(async () => undefined) };
    const batch = vi.fn(async () => []);
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => {
          if (sql.includes("FROM telemetry_source_keys")) return {
            key_id: "key-1", key_kind: "publishable", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Checkout", project_id: "project-1",
            source_environment: "production",
            allowed_origins_json: '["https://app.example.com"]', timezone: "UTC",
            error_cooldown_minutes: 15, environment: "production", alerts_enabled: 1,
            slack_channel_id: "C123", slack_connection_id: "conn-1",
          };
          if (sql.includes("INSERT INTO transport_outbox")) return {
            id: "transport-1", org_id: 7, project_id: "project-1", provider: "slack",
            operation: "slack.message.send", idempotency_key: "telemetry:test", command_json: "{}",
            status: "pending", attempt_count: 0, max_attempts: 5, receipt_json: null,
          };
          return null;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch }, NOX_TASKS: queue,
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
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
    const sourceLookup = prepare.mock.calls.find(([sql]) => String(sql).includes("FROM telemetry_source_keys"));
    expect(String(sourceLookup?.[0])).toContain("alert_route.route_key = 'telemetry_alerts'");
    expect(String(sourceLookup?.[0]).indexOf("NULLIF(alert_route.channel_id"))
      .toBeLessThan(String(sourceLookup?.[0]).indexOf("NULLIF(source.slack_channel_id"));
    const groupUpsert = prepare.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO telemetry_error_groups"));
    expect(String(groupUpsert?.[0])).toContain("status = CASE WHEN telemetry_error_groups.status = 'resolved' THEN 'open'");
    expect(String(groupUpsert?.[0])).toContain("resolved_at = CASE WHEN telemetry_error_groups.status = 'resolved' THEN NULL");
    expect(batch).toHaveBeenCalledOnce();
    expect(queue.send).toHaveBeenCalledWith(expect.objectContaining({ type: "deliver_transport" }));
  });

  it("resolves a scoped API token to one project source without a source key", async () => {
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => sql.includes("FROM telemetry_sources source") ? ({ results: [{
          key_id: null, key_kind: "api_token", org_id: 7, owner_id: "acme",
          source_id: "source-1", source_name: "App", project_id: "project-1",
          allowed_origins_json: "[]", allowed_events_json: "[]", timezone: "UTC",
          error_cooldown_minutes: 15, environment: "production", alerts_enabled: 0,
          aggregate_only_slack: 1, slack_channel_id: null, slack_connection_id: null,
        }] }) : ({ results: [] })),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch: vi.fn() }, NOX_TASKS: { send: vi.fn() },
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleTelemetryEvent(new Request("https://telemetry.internal/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user.active", userId: PROTECTED_USER }),
    }), env, {
      orgId: 7, projectId: "project-1", environment: "production", tokenId: "token-1",
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, environment: "production" });
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes("UPDATE telemetry_source_keys"))).toBe(false);
  });

  it("requires an explicit source when a token project has multiple sources", async () => {
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({ results: sql.includes("FROM telemetry_sources source") ? [
          { source_id: "one" }, { source_id: "two" },
        ] : [] })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare }, TELEMETRY_IP_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleTelemetryEvent(new Request("https://telemetry.internal/v1/events", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }), env, {
      orgId: 7, projectId: "project-1", environment: "production", tokenId: "token-1",
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "source_required" });
  });

  it("reopens and immediately notifies a resolved incident when it regresses", async () => {
    const queue = { send: vi.fn(async () => undefined) };
    const batch = vi.fn(async () => []);
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => {
          if (sql.includes("FROM telemetry_source_keys")) return {
            key_id: "key-1", key_kind: "publishable", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Checkout", project_id: "project-1",
            allowed_origins_json: '["https://app.example.com"]', timezone: "UTC",
            error_cooldown_minutes: 60, environment: "production", alerts_enabled: 1,
            aggregate_only_slack: 0, slack_channel_id: "C123", slack_connection_id: "conn-1",
          };
          if (sql.includes("SELECT occurrence_count, last_notified_at, status")) return {
            occurrence_count: 4,
            last_notified_at: new Date().toISOString(),
            status: "resolved",
          };
          if (sql.includes("INSERT INTO transport_outbox")) return {
            id: "transport-regression", org_id: 7, project_id: "project-1", provider: "slack",
            operation: "slack.message.send", idempotency_key: "telemetry:regression", command_json: "{}",
            status: "pending", attempt_count: 0, max_attempts: 5, receipt_json: null,
          };
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        "Content-Type": "application/json",
        "X-Nox-Ingest-Key": `nox_pub_${"a".repeat(43)}`,
      },
      body: JSON.stringify({ type: "error.occurred", title: "Payment failed" }),
    }), {
      NOX_DB: { prepare, batch }, NOX_TASKS: queue,
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, queued: true, notificationSuppressed: false });
    expect(batch).toHaveBeenCalledOnce();
    expect(queue.send).toHaveBeenCalledWith(expect.objectContaining({ type: "deliver_transport" }));
  });

  it("rejects an event whose environment does not match the source key", async () => {
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => sql.includes("FROM telemetry_source_keys") ? {
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
    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({ type: "user.registered", environment: "staging", userId: PROTECTED_USER }),
    }), {
      NOX_DB: { prepare, batch }, NOX_TASKS: { send: vi.fn() },
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
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
          if (sql.includes("FROM telemetry_source_keys")) return {
            key_id: "key-1", key_kind: "publishable", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Playnist", project_id: "playnist",
            allowed_origins_json: '["https://app.example.com"]', timezone: "UTC",
            error_cooldown_minutes: 15, environment: "production", alerts_enabled: 1,
            slack_channel_id: "C123", slack_connection_id: "conn-1",
          };
          if (sql.includes("FROM telemetry_custom_features")) return null;
          if (sql.includes("INSERT INTO transport_outbox")) return {
            id: "transport-2", org_id: 7, project_id: "playnist", provider: "slack",
            operation: "slack.message.send", idempotency_key: "telemetry:unregistered", command_json: "{}",
            status: "pending", attempt_count: 0, max_attempts: 5, receipt_json: null,
          };
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch }, NOX_TASKS: queue,
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env;

    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
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
    expect(sqlSeen.some((sql) => sql.includes("INSERT INTO telemetry_feature_results"))).toBe(false);
    expect(JSON.stringify(bindings)).toContain("A user could not publish a journal");
    expect(JSON.stringify(bindings)).toContain("DB_TIMEOUT: Database request timed out");
    expect(batch).toHaveBeenCalledOnce();
    expect(queue.send).toHaveBeenCalledOnce();
  });

  it.each([
    ["user.registered", "telemetry_user_registrations"],
    ["user.active", "telemetry_user_active_days"],
  ])("hashes and deduplicates %s facts without storing the raw user ID", async (type, table) => {
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...values: unknown[]) => { bindings.push(values); return statement; }),
        first: vi.fn(async () => sql.includes("FROM telemetry_source_keys") ? {
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
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({ type, userId: PROTECTED_USER, occurredAt: "2026-08-29T02:00:00Z" }),
    }), env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, duplicate: false, period: "2026-08-29" });
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes(table))).toBe(true);
    if (type === "user.registered") {
      expect(prepare.mock.calls.some(([sql]) => String(sql).includes("telemetry_user_active_days"))).toBe(true);
      expect(batch).toHaveBeenCalledOnce();
    }
    const inserted = bindings.find((values) => values.includes("source-1") && values.includes("2026-08-29"));
    expect(inserted).toBeDefined();
    expect(inserted).not.toContain(PROTECTED_USER);
  });

  it("stores a registered activity once without storing the raw user ID", async () => {
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...values: unknown[]) => { bindings.push(values); return statement; }),
        first: vi.fn(async () => {
          if (sql.includes("FROM telemetry_source_keys")) return {
            key_id: "key-1", key_kind: "secret", org_id: 7, owner_id: "acme",
            source_id: "source-1", source_name: "Playnist", project_id: "playnist",
            allowed_origins_json: "[]", timezone: "UTC", error_cooldown_minutes: 15,
            environment: "production", alerts_enabled: 1,
            slack_channel_id: null, slack_connection_id: null,
          };
          if (sql.includes("FROM telemetry_custom_metrics")) return { label: "Journals added" };
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    });
    const allow = { limit: vi.fn(async () => ({ success: true })) };
    const env = {
      NOX_DB: { prepare, batch: vi.fn() }, NOX_TASKS: { send: vi.fn() },
      TELEMETRY_IP_RATE_LIMITER: allow, TELEMETRY_ERROR_RATE_LIMITER: allow,
      TELEMETRY_USER_EVENT_RATE_LIMITER: allow, TELEMETRY_ORG_RATE_LIMITER: allow,
    } as unknown as Env;
    const response = await handleTelemetryEvent(new Request("https://api.telemetry.dev/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_secret_${"a".repeat(43)}` },
      body: JSON.stringify({
        type: "activity.occurred", metric: "custom.journals.added", userId: PROTECTED_USER,
        eventId: "89195f9a-4a26-44e6-a147-9f2d003bc7f5", occurredAt: "2026-08-29T02:00:00Z",
      }),
    }), env);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, duplicate: false, period: "2026-08-29" });
    expect(prepare.mock.calls.some(([sql]) => String(sql).includes("INSERT OR IGNORE INTO telemetry_activity_events"))).toBe(true);
    const activityBindings = bindings.find((values) => values.includes("custom.journals.added") && values.includes("2026-08-29"));
    expect(activityBindings).toBeDefined();
    expect(activityBindings).not.toContain(PROTECTED_USER);
  });
});
