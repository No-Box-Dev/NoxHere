import { errorResponse, getCtx } from "../../../lib/db";

const ASSET_ID = /^asset_[a-f0-9]{32}$/;

interface FeedbackAssetRow {
  id: string;
  report_id: string;
  project_id: string | null;
  role: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  r2_key: string;
  expires_at: string | null;
  deleted_at: string | null;
}

interface Ctx {
  env: { DB: D1Database; FEEDBACK_ASSETS?: R2Bucket };
  data: { orgId: number; projectId?: string | null };
  params: { assetId?: string };
  request: Request;
}

export async function onRequestGet(context: Ctx): Promise<Response> {
  return getAsset(context, false);
}

export async function onRequestHead(context: Ctx): Promise<Response> {
  return getAsset(context, true);
}

async function getAsset(context: Ctx, head: boolean): Promise<Response> {
  const { orgId, projectId } = getCtx(context) as Ctx["data"];
  const assetId = decodeURIComponent(context.params.assetId ?? "");
  if (!orgId || !ASSET_ID.test(assetId)) return errorResponse("Feedback asset not found", 404);
  if (!context.env.FEEDBACK_ASSETS) return errorResponse("Feedback evidence storage is unavailable", 503);

  const row = await context.env.DB.prepare(
    `SELECT id, report_id, project_id, role, media_type, size_bytes, sha256, r2_key,
            expires_at, deleted_at
       FROM feedback_assets
      WHERE id = ? AND org_id = ?${projectId ? " AND project_id = ?" : ""}
      LIMIT 1`,
  ).bind(assetId, orgId, ...(projectId ? [projectId] : [])).first<FeedbackAssetRow>();
  if (!row) return errorResponse("Feedback asset not found", 404);
  if (row.deleted_at || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
    return errorResponse("Feedback asset is no longer available", 410);
  }

  const object = head
    ? await context.env.FEEDBACK_ASSETS.head(row.r2_key)
    : await context.env.FEEDBACK_ASSETS.get(row.r2_key);
  if (!object) return errorResponse("Feedback asset is no longer available", 410);

  const headers = new Headers({
    "Content-Type": row.media_type,
    "Content-Length": String(row.size_bytes),
    "Content-Disposition": `inline; filename="${filename(row)}"`,
    "Cache-Control": "private, no-store",
    "ETag": object.httpEtag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox;",
    "Referrer-Policy": "no-referrer",
    "X-NoxHere-Evidence-Id": row.id,
    "X-Content-SHA256": row.sha256,
  });
  return new Response(head ? null : (object as R2ObjectBody).body, { status: 200, headers });
}

function filename(row: FeedbackAssetRow): string {
  const extension = row.media_type === "image/png" ? "png"
    : row.media_type === "image/webp" ? "webp"
      : row.media_type === "image/jpeg" ? "jpg"
        : row.media_type === "application/json" ? "json"
          : row.media_type === "text/plain" ? "txt"
            : row.media_type === "video/webm" ? "webm"
              : row.media_type === "video/mp4" ? "mp4"
                : row.media_type === "application/zip" ? "zip"
                  : "bin";
  const role = row.role.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "evidence";
  return `feedback-${role}.${extension}`;
}
