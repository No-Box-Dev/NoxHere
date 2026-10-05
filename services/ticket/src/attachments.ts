import type { ServiceResult, TicketScope } from "./specs";
import { attachmentContentType, MAX_ATTACHMENT_BYTES, safeAttachmentFilename } from "./attachment-policy";

const MAX_PER_SPEC = 20;
const CONTENT_TYPES = {
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html; charset=utf-8",
} as const;

interface AttachmentRow {
  id: number; org_id: number; spec_id: number; filename: string; content_type: string;
  size: number; r2_key: string; uploaded_by: string; uploaded_at: string;
}

function failure(error: string, status: number): ServiceResult { return { ok: false, status, error }; }
function success<T>(data: T, status = 200): ServiceResult<T> { return { ok: true, status, data }; }
function scopeIsValid(scope: TicketScope) {
  return Number.isInteger(scope?.orgId) && scope.orgId > 0 && Boolean(scope?.projectId) && Boolean(scope?.userLogin);
}

// Attachments carry no project column; the owning spec decides the project.
async function specInScope(db: D1Database, scope: TicketScope, specId: number) {
  return Boolean(await db.prepare("SELECT 1 FROM specs WHERE id = ? AND org_id = ? AND project_id = ?").bind(specId, scope.orgId, scope.projectId).first());
}

function dto(row: AttachmentRow) {
  const lower = row.filename.toLowerCase();
  const kind = lower.endsWith(".md") ? "markdown" : lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : lower.endsWith(".html") ? "html" : "other";
  return { id: row.id, filename: row.filename, contentType: row.content_type, size: row.size, uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at, kind };
}

export async function listAttachments(db: D1Database, scope: TicketScope, specId: number): Promise<ServiceResult> {
  if (!scopeIsValid(scope) || !Number.isInteger(specId) || specId <= 0) return failure("Invalid scope or spec id", 400);
  if (!await specInScope(db, scope, specId)) return failure(`Unknown spec ${specId}`, 404);
  const { results = [] } = await db.prepare("SELECT id, org_id, spec_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at FROM spec_attachments WHERE org_id = ? AND spec_id = ? ORDER BY uploaded_at DESC")
    .bind(scope.orgId, specId).all<AttachmentRow>();
  return success({ attachments: results.map(dto) });
}

export async function putAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, specId: number, name: unknown, bytes: ArrayBuffer): Promise<ServiceResult> {
  if (!scopeIsValid(scope) || !Number.isInteger(specId) || specId <= 0) return failure("Invalid scope or spec id", 400);
  const safeName = safeAttachmentFilename(name, CONTENT_TYPES);
  if (!safeName) return failure("Unsupported filename. Allowed extensions: .md, .pdf, .docx, .html", 415);
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength <= 0) return failure("File is empty", 400);
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return failure("File too large — max 10 MB per attachment", 413);
  if (!await specInScope(db, scope, specId)) return failure(`Unknown spec ${specId}`, 404);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM spec_attachments WHERE org_id = ? AND spec_id = ?").bind(scope.orgId, specId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PER_SPEC) return failure(`Spec already has ${MAX_PER_SPEC} attachments (the cap)`, 409);
  const pendingKey = `pending/${scope.orgId}/${specId}/${crypto.randomUUID()}`;
  const type = attachmentContentType(safeName, CONTENT_TYPES);
  const row = await db.prepare("INSERT INTO spec_attachments (org_id, spec_id, filename, content_type, size, r2_key, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, org_id, spec_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at")
    .bind(scope.orgId, specId, safeName, type, bytes.byteLength, pendingKey, scope.userLogin).first<AttachmentRow>();
  if (!row) return failure("Failed to record attachment", 500);
  const key = `spec/${scope.orgId}/${specId}/${row.id}`;
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
    await db.prepare("UPDATE spec_attachments SET r2_key = ? WHERE id = ? AND org_id = ?").bind(key, row.id, scope.orgId).run();
    return success(dto({ ...row, r2_key: key }), 201);
  } catch (error) {
    await db.prepare("DELETE FROM spec_attachments WHERE id = ? AND org_id = ?").bind(row.id, scope.orgId).run();
    console.error(JSON.stringify({ event: "noxticket_attachment_put_failed", attachmentId: row.id, error: error instanceof Error ? error.message : String(error) }));
    return failure("Failed to store attachment", 500);
  }
}

export async function getAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, specId: number, attachmentId: number): Promise<Response> {
  if (!scopeIsValid(scope) || !Number.isInteger(specId) || !Number.isInteger(attachmentId) || specId <= 0 || attachmentId <= 0) return Response.json({ error: "Invalid ids" }, { status: 400 });
  if (!await specInScope(db, scope, specId)) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const row = await db.prepare("SELECT id, org_id, spec_id, filename, content_type, size, r2_key, uploaded_by, uploaded_at FROM spec_attachments WHERE id = ? AND spec_id = ? AND org_id = ?")
    .bind(attachmentId, specId, scope.orgId).first<AttachmentRow>();
  if (!row) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const object = await bucket.get(row.r2_key);
  if (!object) return Response.json({ error: "Attachment object missing in storage" }, { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": row.content_type,
    "Content-Length": String(row.size),
    "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none';",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function deleteAttachment(db: D1Database, bucket: R2Bucket, scope: TicketScope, specId: number, attachmentId: number): Promise<ServiceResult> {
  if (!scopeIsValid(scope) || !Number.isInteger(specId) || !Number.isInteger(attachmentId) || specId <= 0 || attachmentId <= 0) return failure("Invalid ids", 400);
  if (!await specInScope(db, scope, specId)) return failure("Attachment not found", 404);
  const row = await db.prepare("SELECT id, r2_key FROM spec_attachments WHERE id = ? AND spec_id = ? AND org_id = ?").bind(attachmentId, specId, scope.orgId).first<{ id: number; r2_key: string }>();
  if (!row) return failure("Attachment not found", 404);
  try { await bucket.delete(row.r2_key); } catch { return failure("Failed to delete attachment from storage", 500); }
  await db.prepare("DELETE FROM spec_attachments WHERE id = ? AND org_id = ?").bind(row.id, scope.orgId).run();
  return success({ ok: true, id: row.id });
}
