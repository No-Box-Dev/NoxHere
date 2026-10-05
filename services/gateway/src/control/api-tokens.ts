import { z } from "zod";
import type { AuthContext } from "./auth";
import { API_TOKEN_SCOPES, createApiTokenValue } from "./auth";
import { sha256 } from "./crypto";
import { apiError, apiResponse, boundedJson } from "./http";

const CreateToken = z.object({
  name: z.string().trim().min(1).max(80),
  environment: z.enum(["live", "test"]).default("live"),
  projectId: z.string().trim().min(1).max(240),
  scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1).max(12),
  expiresInDays: z.number().int().min(1).max(365).default(90),
}).strict();

function requireAdminSession(auth: AuthContext): Response | null {
  if (!auth.isAdmin) return apiError("admin_required", "Only an organization admin can manage API tokens", 403);
  if (auth.credentialType !== "session") {
    return apiError("session_required", "API token management requires an organization-admin browser session", 403);
  }
  return null;
}

export async function handleApiTokens(
  request: Request,
  db: D1Database,
  auth: AuthContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/api-tokens(?:\/([^/]+)(?:\/(rotate))?)?$/);
  if (!match) return null;
  const denied = requireAdminSession(auth);
  if (denied) return denied;

  if (request.method === "GET" && !match[1]) {
    const result = await db.prepare(
      `SELECT token.id, token.name, token.environment, token.project_id,
              project.name AS project_name, token.token_prefix, token.scopes_json,
              token.created_by, token.created_at, token.expires_at,
              token.last_used_at, token.revoked_at
         FROM api_tokens token
         JOIN projects project ON project.id = token.project_id
        WHERE token.org_id = ? ORDER BY token.created_at DESC`,
    ).bind(auth.orgId).all<Record<string, unknown>>();
    return apiResponse({ apiVersion: 1, tokens: result.results.map(serializeToken) });
  }

  if (request.method === "POST" && !match[1]) {
    let input: unknown;
    try { input = await boundedJson(request); }
    catch { return apiError("invalid_request", "Request body must be valid bounded JSON", 400); }
    const parsed = CreateToken.safeParse(input);
    if (!parsed.success) return apiError("invalid_request", "API token settings are invalid", 400, { issues: parsed.error.issues });
    const project = await db.prepare(
      `SELECT id, name FROM projects
        WHERE id = ? AND org_id = ? AND enabled = 1 AND archived = 0`,
    ).bind(parsed.data.projectId, auth.orgId).first<{ id: string; name: string }>();
    if (!project) return apiError("project_not_found", "Choose an enabled project in this organization", 422);
    const credential = await createApiTokenValue(parsed.data.environment);
    const scopes = [...new Set(parsed.data.scopes)].sort();
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString();
    await db.batch([
      db.prepare(
        `INSERT INTO api_tokens
           (id, org_id, project_id, name, environment, token_prefix, token_hash,
            scopes_json, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        credential.id, auth.orgId, project.id, parsed.data.name,
        parsed.data.environment, credential.prefix, await sha256(credential.token),
        JSON.stringify(scopes), auth.userLogin, expiresAt,
      ),
      auditStatement(db, auth, "api_token.created", credential.id, {
        projectId: project.id, scopes, expiresAt,
      }),
    ]);
    return apiResponse({
      apiVersion: 1,
      token: credential.token,
      credential: {
        id: credential.id,
        name: parsed.data.name,
        environment: parsed.data.environment,
        projectId: project.id,
        projectName: project.name,
        prefix: credential.prefix,
        scopes,
        expiresAt,
      },
      warning: "Copy this token now. NoxHere cannot display it again.",
    }, 201);
  }

  if (request.method === "POST" && match[1] && match[2] === "rotate") {
    const id = decodeURIComponent(match[1]);
    const current = await db.prepare(
      `SELECT id, name, environment, project_id, scopes_json, expires_at
         FROM api_tokens
        WHERE id = ? AND org_id = ? AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)` ,
    ).bind(id, auth.orgId, new Date().toISOString()).first<{
      id: string;
      name: string;
      environment: "live" | "test";
      project_id: string;
      scopes_json: string;
      expires_at: string | null;
    }>();
    if (!current) return apiError("not_found", "API token not found, expired, or already revoked", 404);
    const project = await db.prepare(
      `SELECT name FROM projects
        WHERE id = ? AND org_id = ? AND enabled = 1 AND archived = 0`,
    ).bind(current.project_id, auth.orgId).first<{ name: string }>();
    if (!project) return apiError("project_not_enabled", "The token's project is no longer enabled", 409);

    let scopes: string[];
    try {
      const parsed = JSON.parse(current.scopes_json) as unknown;
      if (!Array.isArray(parsed) || parsed.some((scope) => typeof scope !== "string")) throw new Error();
      scopes = parsed;
    } catch {
      return apiError("invalid_token_record", "The stored API token cannot be rotated", 409);
    }
    const replacement = await createApiTokenValue(current.environment);
    await db.batch([
      db.prepare(
        `INSERT INTO api_tokens
           (id, org_id, project_id, name, environment, token_prefix, token_hash,
            scopes_json, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        replacement.id, auth.orgId, current.project_id, current.name,
        current.environment, replacement.prefix, await sha256(replacement.token),
        current.scopes_json, auth.userLogin, current.expires_at,
      ),
      db.prepare(
        `UPDATE api_tokens
            SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ? AND org_id = ? AND revoked_at IS NULL`,
      ).bind(current.id, auth.orgId),
      auditStatement(db, auth, "api_token.rotated", current.id, { replacementId: replacement.id }),
    ]);
    return apiResponse({
      apiVersion: 1,
      token: replacement.token,
      credential: {
        id: replacement.id,
        name: current.name,
        environment: current.environment,
        projectId: current.project_id,
        projectName: project.name,
        prefix: replacement.prefix,
        scopes,
        expiresAt: current.expires_at,
        replaces: current.id,
      },
      warning: "Copy this token now. NoxHere cannot display it again.",
    }, 201);
  }

  if (request.method === "DELETE" && match[1] && !match[2]) {
    const id = decodeURIComponent(match[1]);
    const result = await db.prepare(
      `UPDATE api_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND org_id = ? AND revoked_at IS NULL`,
    ).bind(id, auth.orgId).run();
    if (!result.meta.changes) return apiError("not_found", "API token not found or already revoked", 404);
    await auditStatement(db, auth, "api_token.revoked", id).run();
    return apiResponse({ apiVersion: 1, revoked: true, id });
  }

  return apiError("method_not_allowed", "Method not allowed", 405);
}

function auditStatement(
  db: D1Database,
  auth: AuthContext,
  action: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO auth_audit_log
       (org_id, actor_type, actor_id, action, target_id, metadata_json)
     VALUES (?, 'user', ?, ?, ?, ?)`,
  ).bind(auth.orgId, auth.userLogin, action, targetId, JSON.stringify(metadata));
}

function serializeToken(row: Record<string, unknown>): Record<string, unknown> {
  let scopes: unknown[] = [];
  try { scopes = JSON.parse(String(row.scopes_json)) as unknown[]; }
  catch { scopes = []; }
  return {
    id: row.id,
    name: row.name,
    environment: row.environment,
    projectId: row.project_id,
    projectName: row.project_name,
    prefix: row.token_prefix,
    scopes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}
