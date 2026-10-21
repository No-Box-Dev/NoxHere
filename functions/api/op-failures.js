import { getCtx, jsonResponse, errorResponse } from "../lib/db";
import { requeueQuarantinedTask } from "../lib/task-quarantine.js";

// GET /api/op-failures — admin-only view of background operation failures.
// These are errors swallowed by `context.waitUntil(...)` (narrate, match,
// bootstrap, backfill) that would otherwise only land in worker logs. The
// table is small and append-only; we cap the response to keep payloads bounded.
const MAX_ROWS = 100;
const DEFAULT_ROWS = 25;

export async function onRequestGet(context) {
  const { orgLogin, isAdmin } = getCtx(context);
  if (!orgLogin) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);

  const url = new URL(context.request.url);
  const requested = Number(url.searchParams.get("limit")) || DEFAULT_ROWS;
  const limit = Math.max(1, Math.min(MAX_ROWS, requested));

  const [rows, quarantined] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, op, delivery_id, error, occurred_at
         FROM op_failures
        WHERE owner_id = ?
        ORDER BY occurred_at DESC, id DESC
        LIMIT ?`
    )
    .bind(orgLogin, limit)
    .all(),
    context.env.DB.prepare(
      `SELECT id, task_type, delivery_id, attempts, error, status, quarantined_at, requeued_at
         FROM task_quarantine
        WHERE owner_id = ?
        ORDER BY quarantined_at DESC, id DESC
        LIMIT ?`,
    ).bind(orgLogin, limit).all(),
  ]);

  return jsonResponse({ failures: rows.results ?? [], quarantined: quarantined.results ?? [] });
}

export async function onRequestPost(context) {
  const { orgLogin, isAdmin } = getCtx(context);
  if (!orgLogin) return errorResponse("Missing org context", 400);
  if (!isAdmin) return errorResponse("Admin required", 403);
  const input = await context.request.json().catch(() => null);
  const id = Number(input?.quarantineId);
  if (!Number.isSafeInteger(id) || id <= 0) return errorResponse("Valid quarantineId required", 400);
  if (!context.env.TASK_QUEUE) return errorResponse("Recovery queue unavailable", 503);
  const result = await requeueQuarantinedTask(context.env.DB, context.env.TASK_QUEUE, orgLogin, id);
  if (result.status === "not_found") return errorResponse("Quarantined task not found", 404);
  return jsonResponse(result, 202);
}
