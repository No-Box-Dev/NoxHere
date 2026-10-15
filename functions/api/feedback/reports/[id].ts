import { z } from "zod";
import { getCtx, errorResponse, jsonResponse } from "../../../lib/db";
import { updateFeedbackReport } from "../../../lib/feedback-resolution.js";

const MAX_BODY_BYTES = 16 * 1024;
const UpdateReport = z.object({
  status: z.enum(["open", "investigating", "resolved"]),
  summary: z.string().trim().max(4_000).optional(),
  notify: z.boolean().optional().default(false),
  retryNotification: z.boolean().optional().default(false),
}).strict().refine((value) => value.status === "resolved" || (!value.notify && !value.retryNotification), {
  message: "Notifications can only be sent for resolved reports",
});

interface Context {
  request: Request;
  env: { DB: D1Database; TASK_QUEUE: Queue };
  params: { id?: string };
  data: {
    orgId: number;
    orgLogin: string;
    userLogin: string;
    isAdmin: boolean;
    projectId?: string | null;
    auth?: { type?: string };
  };
}

const REPORT_ID = /^[A-Za-z0-9:_-]{1,120}$/;

export async function onRequestGet(context: Context): Promise<Response> {
  const auth = getCtx(context) as Context["data"];
  const reportId = decodeURIComponent(context.params.id ?? "").trim();
  if (!REPORT_ID.test(reportId)) return errorResponse("Feedback report not found", 404);
  const projectFilter = auth.projectId ? " AND report.project_id = ?" : "";
  const report = await context.env.DB.prepare(
    `SELECT report.id, report.project_id, report.site_id, report.repo, report.issue_number,
            report.issue_url, report.title, report.reporter_name, report.reporter_avatar_url,
            report.status, report.resolution_summary, report.resolved_at, report.resolved_by,
            report.created_at, report.updated_at
       FROM spot_reports report
      WHERE report.id = ? AND report.org_id = ?${projectFilter}
      LIMIT 1`,
  ).bind(reportId, auth.orgId, ...(auth.projectId ? [auth.projectId] : [])).first<Record<string, unknown>>();
  if (!report) return errorResponse("Feedback report not found", 404);
  const assets = await context.env.DB.prepare(
    `SELECT id, role, media_type, size_bytes, sha256, created_at, expires_at
       FROM feedback_assets
      WHERE report_id = ? AND org_id = ?${auth.projectId ? " AND project_id = ?" : ""}
        AND deleted_at IS NULL
      ORDER BY created_at ASC`,
  ).bind(reportId, auth.orgId, ...(auth.projectId ? [auth.projectId] : [])).all<Record<string, unknown>>();
  return jsonResponse({
    report: {
      id: report.id,
      projectId: report.project_id,
      siteId: report.site_id,
      repo: report.repo,
      issueNumber: report.issue_number,
      issueUrl: report.issue_url,
      title: report.title,
      reporter: report.reporter_name,
      reporterAvatarUrl: report.reporter_avatar_url,
      status: report.status,
      resolutionSummary: report.resolution_summary,
      resolvedAt: report.resolved_at,
      resolvedBy: report.resolved_by,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
      evidence: (assets.results ?? []).map(evidenceDto),
    },
  });
}

export async function onRequestPatch(context: Context): Promise<Response> {
  const auth = getCtx(context) as Context["data"];
  if (!auth.isAdmin && auth.auth?.type !== "api_token") return errorResponse("Admin or project API token required", 403);
  const reportId = decodeURIComponent(context.params.id ?? "").trim();
  if (!REPORT_ID.test(reportId)) return errorResponse("Invalid report ID", 400);

  const declaredLength = Number(context.request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return errorResponse("Request body too large", 413);
  const bodyText = await context.request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) return errorResponse("Request body too large", 413);
  let body: unknown;
  try { body = JSON.parse(bodyText); }
  catch { return errorResponse("Invalid JSON body", 400); }
  const parsed = UpdateReport.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid report update", 400);

  const result = await updateFeedbackReport(context.env, {
    reportId,
    orgId: auth.orgId,
    projectId: auth.projectId ?? null,
    ownerId: auth.orgLogin,
    actor: auth.userLogin,
    source: auth.auth?.type === "api_token" ? "api" : "platform",
    ...parsed.data,
  });
  if (!result) return errorResponse("Feedback report not found", 404);
  return jsonResponse({ report: result });
}

function evidenceDto(row: Record<string, unknown>) {
  const id = String(row.id);
  return {
    id,
    type: row.role,
    mediaType: row.media_type,
    size: Number(row.size_bytes),
    sha256: row.sha256,
    url: `/api/v1/feedback/assets/${encodeURIComponent(id)}`,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}
