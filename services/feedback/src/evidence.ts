export type EvidenceRole =
  | "screenshot"
  | "follow_up_screenshot"
  | "dom_snapshot"
  | "console_log"
  | "network_log"
  | "video"
  | "attachment"
  | "diagnostic_bundle";

export interface EvidenceTarget {
  id: string;
  reportId: string;
  key: string;
  url: string;
  contentType: string;
  role: EvidenceRole;
  slackPreview?: {
    baseUrl: string;
    token: string;
    expiresAt: string;
  };
}

export interface StoredEvidence {
  size: number;
  sha256: string;
  slackPreviewUrl: string | null;
}

const encoder = new TextEncoder();
const SLACK_PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export async function evidenceTarget(input: {
  orgId: number;
  siteId: string;
  reportId: string;
  sourceId: string;
  role: EvidenceRole;
  contentType: string;
  apiBaseUrl: string;
  orgLogin?: string | null;
  slackPreviewBaseUrl?: string | null;
}): Promise<EvidenceTarget> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${input.orgId}:${input.siteId}:${input.sourceId}:${input.role}`),
  );
  const id = `asset_${hex(digest).slice(0, 32)}`;
  const url = new URL(`${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/feedback/assets/${id}`);
  if (input.orgLogin?.trim()) url.searchParams.set("org", input.orgLogin.trim());
  return {
    id,
    reportId: input.reportId,
    key: `evidence/${id}`,
    url: url.toString(),
    contentType: input.contentType,
    role: input.role,
    ...(input.slackPreviewBaseUrl ? {
      slackPreview: {
        baseUrl: input.slackPreviewBaseUrl.replace(/\/$/, ""),
        token: previewToken(),
        expiresAt: new Date(Date.now() + SLACK_PREVIEW_TTL_MS).toISOString(),
      },
    } : {}),
  };
}

export async function putEvidence(bucket: R2Bucket, target: EvidenceTarget, bytes: ArrayBuffer | Uint8Array): Promise<StoredEvidence> {
  const data = Uint8Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const digest = await crypto.subtle.digest("SHA-256", data);
  if (target.slackPreview) {
    const existing = await bucket.head(target.key);
    const token = existing?.customMetadata?.slackPreviewToken;
    const expiresAt = existing?.customMetadata?.slackPreviewExpiresAt;
    if (token && expiresAt && Date.parse(expiresAt) > Date.now()) {
      target.slackPreview.token = token;
      target.slackPreview.expiresAt = expiresAt;
    }
  }
  await bucket.put(target.key, data, {
    httpMetadata: { contentType: target.contentType, cacheControl: "private, no-store" },
    ...(target.slackPreview ? { customMetadata: {
      slackPreviewToken: target.slackPreview.token,
      slackPreviewExpiresAt: target.slackPreview.expiresAt,
    } } : {}),
    sha256: digest,
  });
  return {
    size: data.byteLength,
    sha256: hex(digest),
    slackPreviewUrl: target.slackPreview
      ? `${target.slackPreview.baseUrl}/slack-preview/${target.id}/${target.slackPreview.token}`
      : null,
  };
}

export async function recordEvidence(
  db: D1Database,
  target: EvidenceTarget,
  scope: { orgId: number; projectId: string | null; siteId: string },
  stored: StoredEvidence,
): Promise<void> {
  await db.prepare(
    `INSERT INTO feedback_assets
       (id, report_id, org_id, project_id, site_id, role, media_type, size_bytes, sha256, r2_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       media_type = excluded.media_type,
       size_bytes = excluded.size_bytes,
       sha256 = excluded.sha256,
       r2_key = excluded.r2_key,
       expires_at = NULL,
       deleted_at = NULL`,
  ).bind(
    target.id,
    target.reportId,
    scope.orgId,
    scope.projectId,
    scope.siteId,
    target.role,
    target.contentType,
    stored.size,
    stored.sha256,
    target.key,
  ).run();
}

export async function deleteExpiredEvidence(db: D1Database, bucket: R2Bucket, now = new Date()): Promise<number> {
  const expired = await db.prepare(
    `SELECT id, r2_key FROM feedback_assets
      WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?
      ORDER BY expires_at ASC LIMIT 500`,
  ).bind(now.toISOString()).all<{ id: string; r2_key: string }>();
  const rows = expired.results ?? [];
  if (!rows.length) return 0;
  await bucket.delete(rows.map((row) => row.r2_key));
  const deletedAt = now.toISOString();
  await db.batch(rows.map((row) => db.prepare(
    "UPDATE feedback_assets SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
  ).bind(deletedAt, row.id)));
  return rows.length;
}

function hex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function previewToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}
