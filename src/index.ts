import { DurableObject } from "cloudflare:workers";
import { alertRuleSchema, evaluate, evaluationStateSchema, INITIAL_EVALUATION_STATE } from "./domain";

interface DeliveryJob {
  deliveryId: string;
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

async function handleDelivery(_job: DeliveryJob, _env: Env): Promise<void> {
  // Delivery persistence and Slack posting land with the first query adapter.
  // Throwing prevents silent acknowledgement if a job appears prematurely.
  throw new Error("Slack delivery adapter is not enabled yet");
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ service: "noxalerts", status: "ok" });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },

  async queue(batch: MessageBatch<DeliveryJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await handleDelivery(message.body, env);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          message: "alert delivery failed",
          deliveryId: message.body.deliveryId,
          error: error instanceof Error ? error.message : String(error),
        }));
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, DeliveryJob>;
