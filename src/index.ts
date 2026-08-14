import { DurableObject } from "cloudflare:workers";
import {
  buildSlackPayload,
  CANARY_SOURCE,
  CanaryRequestError,
  isAuthorized,
  normalizeSlackPayload,
  readCanaryInput,
  type CanaryDeliveryStatus,
  type NoxSlackDeliveryTask,
} from "./canary";
import { CANARY_PAGE, CANARY_PAGE_HEADERS } from "./canary-page";
import { alertRuleSchema, evaluate, evaluationStateSchema, INITIAL_EVALUATION_STATE } from "./domain";
import { handleBrowserError } from "./errors";

interface CanaryTargetRow {
  org_id: number;
  site_id: null;
  channel_id: string;
}

export class RuleEvaluator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS evaluator_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          state_json TEXT NOT NULL
        );
      `);
    });
  }

  /** Apply a query result. Query execution is deliberately a separate adapter. */
  async apply(ruleInput: unknown, value: number, evaluatedAt: number): Promise<string | null> {
    const rule = alertRuleSchema.parse(ruleInput);
    const row = this.ctx.storage.sql
      .exec<{ state_json: string }>("SELECT state_json FROM evaluator_state WHERE singleton = 1")
      .toArray()[0];
    const previous = row
      ? evaluationStateSchema.parse(JSON.parse(row.state_json))
      : INITIAL_EVALUATION_STATE;
    const result = evaluate(rule, previous, value, evaluatedAt);
    this.ctx.storage.sql.exec(
      `INSERT INTO evaluator_state (singleton, state_json) VALUES (1, ?)
       ON CONFLICT(singleton) DO UPDATE SET state_json = excluded.state_json`,
      JSON.stringify(result.state),
    );
    return result.transition;
  }
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function enqueueCanaryDelivery(env: Env, deliveryId: string): Promise<boolean> {
  try {
    const task: NoxSlackDeliveryTask = {
      type: "deliver_slack",
      outboxId: deliveryId,
      ownerId: env.CANARY_OWNER_ID,
      deliveryId,
    };
    await env.NOX_TASKS.send(task);
    await env.NOX_DB.prepare(
      `UPDATE delivery_outbox SET status = 'queued',
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending'`,
    ).bind(deliveryId).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "canary queue send failed; Unticket recovery will retry",
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return false;
  }
}

async function createCanaryDelivery(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env.CANARY_TOKEN)) return jsonError("unauthorized", 401);
  const input = await readCanaryInput(request);
  const target = await env.NOX_DB.prepare(
    `SELECT org.id AS org_id, NULL AS site_id,
            COALESCE(
              NULLIF(TRIM(json_extract(config.data, '$.slack.postsChannelId')), ''),
              NULLIF(TRIM(json_extract(config.data, '$.slack.releaseNotesChannelId')), '')
            ) AS channel_id
       FROM orgs org
       JOIN config ON config.org_id = org.id AND config.key = 'settings'
      WHERE org.github_login = ?
        AND COALESCE(
              NULLIF(TRIM(json_extract(config.data, '$.slack.postsChannelId')), ''),
              NULLIF(TRIM(json_extract(config.data, '$.slack.releaseNotesChannelId')), '')
            ) IS NOT NULL`,
  ).bind(env.CANARY_OWNER_ID).first<CanaryTargetRow>();
  if (!target) return jsonError("canary_destination_not_configured", 503);

  const recent = await env.NOX_DB.prepare(
    `SELECT 1 AS found FROM delivery_outbox
      WHERE org_id = ? AND source = ?
        AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-15 seconds')
      LIMIT 1`,
  ).bind(target.org_id, CANARY_SOURCE).first<{ found: number }>();
  if (recent) return jsonError("canary_rate_limited", 429);

  const deliveryId = crypto.randomUUID();
  await env.NOX_DB.prepare(
    `INSERT INTO delivery_outbox
       (id, org_id, source, source_id, destination, site_id, channel_id, payload_json, status)
     VALUES (?, ?, ?, ?, 'slack', ?, ?, ?, 'pending')`,
  ).bind(
    deliveryId,
    target.org_id,
    CANARY_SOURCE,
    deliveryId,
    target.site_id,
    target.channel_id,
    JSON.stringify(buildSlackPayload(input, deliveryId)),
  ).run();

  const queued = await enqueueCanaryDelivery(env, deliveryId);

  return Response.json({ accepted: true, queued, deliveryId }, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}

async function retryCanaryDelivery(request: Request, env: Env, deliveryId: string): Promise<Response> {
  if (!isAuthorized(request, env.CANARY_TOKEN)) return jsonError("unauthorized", 401);
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return jsonError("not_found", 404);
  const row = await env.NOX_DB.prepare(
    `SELECT delivery.payload_json AS payloadJson, delivery.status
       FROM delivery_outbox delivery
       JOIN orgs org ON org.id = delivery.org_id
      WHERE delivery.id = ? AND delivery.source = ? AND org.github_login = ?`,
  ).bind(deliveryId, CANARY_SOURCE, env.CANARY_OWNER_ID).first<{ payloadJson: string; status: string }>();
  if (!row) return jsonError("not_found", 404);
  if (row.status === "delivered") return jsonError("already_delivered", 409);

  let payload: ReturnType<typeof normalizeSlackPayload>;
  try {
    payload = normalizeSlackPayload(JSON.parse(row.payloadJson));
  } catch {
    payload = null;
  }
  if (!payload) return jsonError("invalid_delivery_payload", 409);

  await env.NOX_DB.prepare(
    `UPDATE delivery_outbox
        SET payload_json = ?, status = 'pending', attempt_count = 0,
            last_error_code = NULL, last_error = NULL, next_attempt_at = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?`,
  ).bind(JSON.stringify(payload), deliveryId).run();
  const queued = await enqueueCanaryDelivery(env, deliveryId);
  return Response.json({ accepted: true, queued, deliveryId }, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getCanaryDelivery(request: Request, env: Env, deliveryId: string): Promise<Response> {
  if (!isAuthorized(request, env.CANARY_TOKEN)) return jsonError("unauthorized", 401);
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return jsonError("not_found", 404);
  const row = await env.NOX_DB.prepare(
    `SELECT delivery.id, delivery.status, delivery.attempt_count AS attemptCount,
            delivery.last_error_code AS errorCode, delivery.slack_message_ts AS slackMessageTs,
            delivery.created_at AS createdAt,
            delivery.delivered_at AS deliveredAt
       FROM delivery_outbox delivery
       JOIN orgs org ON org.id = delivery.org_id
      WHERE delivery.id = ? AND delivery.source = ? AND org.github_login = ?`,
  ).bind(deliveryId, CANARY_SOURCE, env.CANARY_OWNER_ID).first<CanaryDeliveryStatus>();
  if (!row) return jsonError("not_found", 404);
  return Response.json(row, { headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "noxalert", status: "ok" });
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/canary")) {
      return new Response(CANARY_PAGE, { headers: CANARY_PAGE_HEADERS });
    }
    try {
      if (url.pathname === "/v1/errors") {
        return await handleBrowserError(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/canary") {
        return await createCanaryDelivery(request, env);
      }
      if (request.method === "POST") {
        const retryMatch = url.pathname.match(/^\/api\/canary\/([^/]+)\/retry$/);
        if (retryMatch?.[1]) return await retryCanaryDelivery(request, env, retryMatch[1]);
      }
      if (request.method === "GET") {
        const statusMatch = url.pathname.match(/^\/api\/canary\/([^/]+)$/);
        if (statusMatch?.[1]) return await getCanaryDelivery(request, env, statusMatch[1]);
      }
    } catch (error) {
      if (error instanceof CanaryRequestError) return jsonError(error.message, error.status);
      console.error(JSON.stringify({
        message: "canary request failed",
        error: error instanceof Error ? error.message : String(error),
      }));
      return jsonError("internal_error", 500);
    }
    return jsonError("not_found", 404);
  },
} satisfies ExportedHandler<Env>;
