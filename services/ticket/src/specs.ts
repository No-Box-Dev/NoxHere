import { z } from "zod";

const specLinkSchema = z.object({
  url: z.string(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
}).strict();

const createSpecSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long (max 200)"),
  description: z.string().max(20_000, "Description too long (max 20000)").optional(),
  featureNumber: z.number().int().positive().nullable().optional(),
  links: z.array(specLinkSchema).max(50).optional(),
}).strict();

const updateSpecSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  featureNumber: z.number().int().positive().nullable().optional(),
  isPrimary: z.boolean().optional(),
  links: z.array(specLinkSchema).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export interface TicketScope { orgId: number; projectId: string; userLogin: string; isAdmin?: boolean }
export interface SpecFilters { featureNumber?: number | "unfiled"; includeArchived?: boolean }
export interface ServiceResult<T = unknown> { ok: boolean; status: number; data?: T; error?: string }

interface SpecRow {
  id: number; org_id: number; feature_number: number | null; is_primary: number;
  title: string; description: string; links_json: string; archived: number;
  archived_at: string | null; created_by: string; created_at: string; updated_at: string;
}

const COLUMNS = "id, org_id, feature_number, is_primary, title, description, links_json, archived, archived_at, created_by, created_at, updated_at";

function result<T>(data: T, status = 200): ServiceResult<T> { return { ok: true, status, data }; }
function failure(error: string, status: number): ServiceResult { return { ok: false, status, error }; }

function sanitizeLinks(input: unknown) {
  if (!Array.isArray(input)) return [];
  const links: Array<{ url: string; label?: string; primary?: boolean }> = [];
  let hasPrimary = false;
  for (const item of input.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const rawUrl = typeof (item as { url?: unknown }).url === "string" ? String((item as { url: string }).url).trim() : "";
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    } catch { continue; }
    const rawLabel = (item as { label?: unknown }).label;
    const label = typeof rawLabel === "string" ? rawLabel.trim().slice(0, 200) : "";
    const primary = (item as { primary?: unknown }).primary === true && !hasPrimary;
    if (primary) hasPrimary = true;
    links.push({ url: rawUrl, ...(label ? { label } : {}), ...(primary ? { primary: true } : {}) });
  }
  return links;
}

function toDto(row: SpecRow) {
  let links: ReturnType<typeof sanitizeLinks> = [];
  try { links = sanitizeLinks(JSON.parse(row.links_json || "[]")); } catch { /* bounded empty fallback */ }
  return {
    id: row.id, featureNumber: row.feature_number, isPrimary: row.is_primary === 1,
    title: row.title, description: row.description ?? "", links,
    archived: row.archived === 1, archivedAt: row.archived_at,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function validScope(scope: TicketScope): boolean {
  return Number.isInteger(scope?.orgId) && scope.orgId > 0
    && typeof scope.projectId === "string" && scope.projectId.length > 0
    && typeof scope.userLogin === "string" && scope.userLogin.length > 0;
}

export async function listSpecs(db: D1Database, scope: TicketScope, filters: SpecFilters = {}): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  const clauses = ["org_id = ?", "project_id = ?"];
  const binds: Array<string | number> = [scope.orgId, scope.projectId];
  if (filters.featureNumber === "unfiled") clauses.push("feature_number IS NULL");
  else if (typeof filters.featureNumber === "number") {
    if (!Number.isInteger(filters.featureNumber) || filters.featureNumber <= 0) return failure("Invalid featureNumber", 400);
    clauses.push("feature_number = ?"); binds.push(filters.featureNumber);
  }
  if (!filters.includeArchived) clauses.push("archived = 0");
  const { results = [] } = await db.prepare(`SELECT ${COLUMNS} FROM specs WHERE ${clauses.join(" AND ")} ORDER BY archived ASC, updated_at DESC`).bind(...binds).all<SpecRow>();
  return result({ specs: results.map(toDto) });
}

export async function getSpec(db: D1Database, scope: TicketScope, id: number): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  if (!Number.isInteger(id) || id <= 0) return failure("Invalid spec id", 400);
  const row = await db.prepare(`SELECT ${COLUMNS} FROM specs WHERE id = ? AND org_id = ? AND project_id = ?`).bind(id, scope.orgId, scope.projectId).first<SpecRow>();
  return row ? result(toDto(row)) : failure(`Unknown spec ${id}`, 404);
}

export async function createSpec(db: D1Database, scope: TicketScope, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  const parsed = createSpecSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid spec", 400);
  const { title, description = "", featureNumber = null, links = [] } = parsed.data;
  if (featureNumber != null) {
    const feature = await db.prepare("SELECT 1 FROM features WHERE org_id = ? AND project_id = ? AND id = ?").bind(scope.orgId, scope.projectId, featureNumber).first();
    if (!feature) return failure(`Unknown feature #${featureNumber}`, 400);
  }
  const row = await db.prepare(`INSERT INTO specs (org_id, project_id, feature_number, title, description, links_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)
    .bind(scope.orgId, scope.projectId, featureNumber, title, description, JSON.stringify(sanitizeLinks(links)), scope.userLogin).first<SpecRow>();
  return row ? result(toDto(row), 201) : failure("Failed to create spec", 500);
}

export async function updateSpec(db: D1Database, scope: TicketScope, id: number, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  if (!Number.isInteger(id) || id <= 0) return failure("Invalid spec id", 400);
  const parsed = updateSpecSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid spec", 400);
  const patch = parsed.data;
  const current = await db.prepare("SELECT feature_number, archived FROM specs WHERE id = ? AND org_id = ? AND project_id = ?").bind(id, scope.orgId, scope.projectId).first<{ feature_number: number | null; archived: number }>();
  if (!current) return failure(`Unknown spec ${id}`, 404);
  if (patch.featureNumber != null) {
    const feature = await db.prepare("SELECT 1 FROM features WHERE org_id = ? AND project_id = ? AND id = ?").bind(scope.orgId, scope.projectId, patch.featureNumber).first();
    if (!feature) return failure(`Unknown feature #${patch.featureNumber}`, 400);
  }
  const targetFeature = patch.featureNumber !== undefined ? patch.featureNumber : current.feature_number;
  if (patch.isPrimary) {
    if (targetFeature == null || current.archived === 1) return failure("Only an active spec attached to a feature can be primary", 422);
    const sibling = await db.prepare("SELECT 1 FROM specs WHERE org_id = ? AND project_id = ? AND feature_number = ? AND archived = 0 AND id != ? LIMIT 1").bind(scope.orgId, scope.projectId, targetFeature, id).first();
    if (!sibling) return failure("A primary spec can only be selected when a feature has multiple specs", 422);
  }
  const sets: string[] = [];
  const binds: Array<string | number | null> = [];
  if (patch.title !== undefined) { sets.push("title = ?"); binds.push(patch.title); }
  if (patch.description !== undefined) { sets.push("description = ?"); binds.push(patch.description); }
  if (patch.featureNumber !== undefined) { sets.push("feature_number = ?"); binds.push(patch.featureNumber); if (patch.isPrimary === undefined) sets.push("is_primary = 0"); }
  if (patch.isPrimary !== undefined) { sets.push("is_primary = ?"); binds.push(patch.isPrimary ? 1 : 0); }
  if (patch.links !== undefined) { sets.push("links_json = ?"); binds.push(JSON.stringify(sanitizeLinks(patch.links))); }
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
  const statement = db.prepare(`UPDATE specs SET ${sets.join(", ")} WHERE id = ? AND org_id = ? AND project_id = ? RETURNING ${COLUMNS}`).bind(...binds, id, scope.orgId, scope.projectId);
  let row: SpecRow | null;
  if (patch.isPrimary && targetFeature != null) {
    await db.batch([db.prepare("UPDATE specs SET is_primary = 0 WHERE org_id = ? AND project_id = ? AND feature_number = ? AND id != ? AND is_primary = 1").bind(scope.orgId, scope.projectId, targetFeature, id), statement]);
    row = await db.prepare(`SELECT ${COLUMNS} FROM specs WHERE id = ? AND org_id = ? AND project_id = ?`).bind(id, scope.orgId, scope.projectId).first<SpecRow>();
  } else row = await statement.first<SpecRow>();
  return row ? result(toDto(row)) : failure(`Unknown spec ${id}`, 404);
}

export async function setSpecArchived(db: D1Database, scope: TicketScope, id: number, archived: boolean): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  if (!scope.isAdmin) return failure("Admin required", 403);
  if (!Number.isInteger(id) || id <= 0) return failure("Invalid spec id", 400);
  const archivedAt = archived ? new Date().toISOString().replace(/\.\d{3}Z$/, "Z") : null;
  const response = await db.prepare("UPDATE specs SET archived = ?, archived_at = ?, is_primary = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? AND org_id = ? AND project_id = ? AND archived = ?")
    .bind(archived ? 1 : 0, archivedAt, id, scope.orgId, scope.projectId, archived ? 0 : 1).run();
  if (!(response.meta?.changes ?? 0)) return failure(`Unknown spec ${id} (or already ${archived ? "archived" : "active"})`, 404);
  return result({ ok: true, id, archived });
}
