import type { ServiceResult, TicketScope } from "./specs";
import { attachmentContentType, MAX_ATTACHMENT_BYTES, safeAttachmentFilename } from "./attachment-policy";

const MAX_PER_FEATURE = 20;
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

interface FeatureAttachmentRow {
  id: number; org_id: number; project_id: string; feature_id: number; filename: string;
  content_type: string; size: number; r2_key: string; uploaded_by: string; uploaded_at: string;
}

function failure(error: string, status: number): ServiceResult { return { ok: false, status, error }; }
function success<T>(data: T, status = 200): ServiceResult<T> { return { ok: true, status, data }; }
function validScope(scope: TicketScope) {
  return Number.isInteger(scope?.orgId) && scope.orgId > 0 && Boolean(scope?.projectId) && Boolean(scope?.userLogin);
}
function dto(row: FeatureAttachmentRow) {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    kind: row.content_type.startsWith("image/") ? "image" : "pdf",
  };
}
async function featureInScope(db: D1Database, scope: TicketScope, featureId: number) {
  return Boolean(await db.prepare("SELECT 1 FROM features WHERE id = ? AND org_id = ? AND project_id = ?")
    .bind(featureId, scope.orgId, scope.projectId).first());
}

export async function listFeatureAttachments(db: D1Database, scope: TicketScope, featureId: number): Promise<ServiceResult> {
  if (!validScope(scope) || !Number.isInteger(featureId) || featureId <= 0) return failure("Invalid scope or feature id", 400);
  if (!await featureInScope(db, scope, featureId)) return failure("Feature not found", 404);
  const { results = [] } = await db.prepare(`SELECT id, org_id, project_id, feature_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at
    FROM feature_attachments WHERE org_id = ? AND project_id = ? AND feature_id = ? ORDER BY uploaded_at DESC`)
    .bind(scope.orgId, scope.projectId, featureId).all<FeatureAttachmentRow>();
  return success({ attachments: results.map(dto) });
}

export async function putFeatureAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, featureId: number, name: unknown, bytes: ArrayBuffer): Promise<ServiceResult> {
  if (!validScope(scope) || !Number.isInteger(featureId) || featureId <= 0) return failure("Invalid scope or feature id", 400);
  const filename = safeAttachmentFilename(name, TYPES);
  if (!filename) return failure("Unsupported file. Use PNG, JPEG, WebP, GIF, or PDF", 415);
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength <= 0) return failure("File is empty", 400);
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return failure("File too large — max 10 MB", 413);
  if (!await featureInScope(db, scope, featureId)) return failure("Feature not found", 404);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM feature_attachments WHERE org_id = ? AND project_id = ? AND feature_id = ?")
    .bind(scope.orgId, scope.projectId, featureId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PER_FEATURE) return failure(`Feature already has ${MAX_PER_FEATURE} attachments`, 409);
  const pendingKey = `pending/feature/${scope.orgId}/${scope.projectId}/${featureId}/${crypto.randomUUID()}`;
  const type = attachmentContentType(filename, TYPES);
  const row = await db.prepare(`INSERT INTO feature_attachments
    (org_id, project_id, feature_id, filename, content_type, size, r2_key, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, org_id, project_id, feature_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at`)
    .bind(scope.orgId, scope.projectId, featureId, filename, type, bytes.byteLength, pendingKey, scope.userLogin).first<FeatureAttachmentRow>();
  if (!row) return failure("Failed to record attachment", 500);
  const key = `feature/${scope.orgId}/${scope.projectId}/${featureId}/${row.id}`;
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
    await db.prepare("UPDATE feature_attachments SET r2_key = ? WHERE id = ? AND org_id = ?").bind(key, row.id, scope.orgId).run();
    return success(dto({ ...row, r2_key: key }), 201);
  } catch (error) {
    await db.prepare("DELETE FROM feature_attachments WHERE id = ? AND org_id = ?").bind(row.id, scope.orgId).run();
    console.error(JSON.stringify({ event: "noxticket_feature_attachment_put_failed", attachmentId: row.id, error: error instanceof Error ? error.message : String(error) }));
    return failure("Failed to store attachment", 500);
  }
}

export async function getFeatureAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, featureId: number, attachmentId: number): Promise<Response> {
  if (!validScope(scope) || !Number.isInteger(featureId) || !Number.isInteger(attachmentId) || featureId <= 0 || attachmentId <= 0) return Response.json({ error: "Invalid ids" }, { status: 400 });
  const row = await db.prepare(`SELECT id, org_id, project_id, feature_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at
    FROM feature_attachments WHERE id = ? AND feature_id = ? AND org_id = ? AND project_id = ?`)
    .bind(attachmentId, featureId, scope.orgId, scope.projectId).first<FeatureAttachmentRow>();
  if (!row) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const object = await bucket.get(row.r2_key);
  if (!object) return Response.json({ error: "Attachment object missing in storage" }, { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": row.content_type,
    "Content-Length": String(row.size),
    "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none';",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
  } });
}

export async function deleteFeatureAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, featureId: number, attachmentId: number): Promise<ServiceResult> {
  if (!validScope(scope) || !Number.isInteger(featureId) || !Number.isInteger(attachmentId) || featureId <= 0 || attachmentId <= 0) return failure("Invalid ids", 400);
  const row = await db.prepare("SELECT id, r2_key FROM feature_attachments WHERE id = ? AND feature_id = ? AND org_id = ? AND project_id = ?")
    .bind(attachmentId, featureId, scope.orgId, scope.projectId).first<{ id: number; r2_key: string }>();
  if (!row) return failure("Attachment not found", 404);
  try { await bucket.delete(row.r2_key); } catch { return failure("Failed to delete attachment from storage", 500); }
  await db.prepare("DELETE FROM feature_attachments WHERE id = ? AND org_id = ?").bind(row.id, scope.orgId).run();
  return success({ ok: true, id: row.id });
}
