import { sha256 } from "../control/crypto";
import type { McpContext } from "./mcp";

export const MCP_RATE_POLICY = Object.freeze({
  windowMs: 60_000, ip: 120, token: 60, project: 120,
  retentionMs: 24 * 60 * 60_000, cleanupBatch: 100,
});

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => Response.json({ error: { code: "mcp_rate_limit_unavailable", message: "MCP request admission is temporarily unavailable." } }, { status: 503, headers });
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256;

/** Each upsert atomically counts one attempt. D1 batch keeps both authenticated
 * budgets in one transaction; denied attempts consume both budgets as well.
 * Admission reads the write result, never an eventually consistent read replica.
 */
export async function checkMcpRateLimit(db: D1Database, request: Request, context?: McpContext): Promise<Response | null> {
  try {
    request.signal.throwIfAborted();
    let budgets: { identity: unknown[]; limit: number }[];
    if (context) {
      if (!Number.isSafeInteger(context.orgId) || context.orgId! <= 0
          || !validId(context.credentialId) || !validId(context.projectId)) return unavailable();
      budgets = [
        { identity: ["mcp:token:v1", context.orgId, context.credentialId], limit: MCP_RATE_POLICY.token },
        { identity: ["mcp:project:v1", context.orgId, context.projectId], limit: MCP_RATE_POLICY.project },
      ];
    } else {
      // Cloudflare must supply/overwrite this header at the public ingress.
      // Never fall back to caller-selected X-Forwarded-For or a shared "unknown".
      const ip = request.headers.get("CF-Connecting-IP");
      if (!ip || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return unavailable();
      budgets = [{ identity: ["mcp:ip:v1", ip.toLowerCase()], limit: MCP_RATE_POLICY.ip }];
    }
    const keys = await Promise.all(budgets.map(({ identity }) => sha256(JSON.stringify(identity))));
    request.signal.throwIfAborted();
    // Use the database clock, not independent Worker clocks, for all windows.
    const databaseWindow = "(CAST(strftime('%s', 'now') AS INTEGER) / 60 * 60000)";
    const counters = budgets.map(({ limit }, index) => db.prepare(`
      INSERT INTO mcp_rate_limits (rate_key, window_start, request_count, expires_at)
      VALUES (?, ${databaseWindow}, 1, ${databaseWindow} + ?)
      ON CONFLICT(rate_key) DO UPDATE SET
        request_count = CASE WHEN mcp_rate_limits.window_start >= excluded.window_start
          THEN MIN(mcp_rate_limits.request_count + 1, ?) ELSE 1 END,
        window_start = MAX(mcp_rate_limits.window_start, excluded.window_start),
        expires_at = MAX(mcp_rate_limits.expires_at, excluded.expires_at)
      RETURNING request_count, window_start,
        MAX(1, (window_start + 60000 - CAST(strftime('%s', 'now') AS INTEGER) * 1000) / 1000) AS retry_after
    `).bind(keys[index], MCP_RATE_POLICY.retentionMs, limit + 1));
    // Bounded, indexed, opportunistic cleanup on pre-auth admission. With no
    // traffic, expired rows remain until subsequent requests; this is not a TTL.
    const statements = context ? counters : [db.prepare(`
      DELETE FROM mcp_rate_limits WHERE rate_key IN (
        SELECT rate_key FROM mcp_rate_limits WHERE expires_at <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
        ORDER BY expires_at LIMIT ?
      )
    `).bind(MCP_RATE_POLICY.cleanupBatch), ...counters];
    const results = await db.batch<{ request_count: number; window_start: number; retry_after: number }>(statements);
    request.signal.throwIfAborted();
    if (results.length !== statements.length || results.some((result) => !result.success)) return unavailable();
    const counts = results.slice(context ? 0 : 1);
    let limited = false;
    let retryAfter = 1;
    for (const [index, result] of counts.entries()) {
      const row = result.results?.[0];
      if (result.results?.length !== 1 || !row || !Number.isSafeInteger(row.request_count)
          || row.request_count < 1 || row.request_count > budgets[index].limit + 1
          || !Number.isSafeInteger(row.window_start) || row.window_start < 0 || row.window_start % MCP_RATE_POLICY.windowMs !== 0
          || !Number.isSafeInteger(row.retry_after) || row.retry_after < 1 || row.retry_after > 60) return unavailable();
      limited ||= row.request_count > budgets[index].limit;
      if (row.request_count > budgets[index].limit) retryAfter = Math.max(retryAfter, row.retry_after);
    }
    if (!limited) return null;
    return Response.json({ error: { code: "mcp_rate_limited", message: "MCP request budget exceeded. Retry later." } }, {
      status: 429, headers: { ...headers, "Retry-After": String(retryAfter) },
    });
  } catch {
    return unavailable();
  }
}
