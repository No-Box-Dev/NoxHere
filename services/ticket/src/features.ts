import { z } from "zod";
import type { ServiceResult, TicketScope } from "./specs";

// Features live only in NoxTicket's database. The feature id is the number
// shown in the product (#12) and is what specs link to.

const ownersSchema = z.array(z.string().regex(/^[A-Za-z0-9-]{1,39}$/, "Invalid owner login")).max(20);
const linksSchema = z.array(z.object({
  url: z.url().refine((url) => url.startsWith("https://") || url.startsWith("http://"), "Link must use http or https"),
  label: z.string().trim().max(200, "Link label too long (max 200)").optional(),
}).strict()).max(50, "Too many links (max 50)");
const createSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "Title too long (max 200)"),
  status: z.string().optional(),
  backlog: z.boolean().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  owners: ownersSchema.optional(),
  description: z.string().max(20_000, "Description too long (max 20000)").optional(),
  links: linksSchema.optional(),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "Title too long (max 200)").optional(),
  status: z.string().optional(),
  backlog: z.boolean().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  owners: ownersSchema.optional(),
  description: z.string().max(20_000, "Description too long (max 20000)").optional(),
  links: linksSchema.optional(),
  state: z.enum(["open", "closed"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

interface Stage { id: string; label: string; color: string }
interface StatusChange { status: string; at: string }
interface FeatureRow {
  id: number; title: string; status: string; backlog: number; priority: number; state: "open" | "closed"; plan: string;
  links_json: string; owners_json: string; status_history_json: string; created_by: string; created_at: string; updated_at: string; closed_at: string | null;
}

const COLUMNS = "id, title, status, backlog, priority, state, plan, links_json, owners_json, status_history_json, created_by, created_at, updated_at, closed_at";
const DEFAULT_STAGES: Stage[] = [
  { id: "todo", label: "To do", color: "#94a3b8" },
  { id: "specced", label: "Specced", color: "#8b83b8" },
  { id: "staging", label: "Testing on staging", color: "#b89464" },
  { id: "ready", label: "Ready for production", color: "#6a9991" },
  { id: "production", label: "On production", color: "#6e9970" },
];

function fail(error: string, status: number): ServiceResult { return { ok: false, status, error }; }
function ok<T>(data: T, status = 200): ServiceResult<T> { return { ok: true, status, data }; }
function now() { return new Date().toISOString(); }

function validScope(scope: TicketScope) {
  return Number.isInteger(scope?.orgId) && scope.orgId > 0
    && typeof scope.projectId === "string" && scope.projectId.length > 0
    && typeof scope.userLogin === "string" && scope.userLogin.length > 0;
}

function parseJson<T>(value: string, column: string, id: number): T {
  try { return JSON.parse(value) as T; } catch {
    throw new Error(`Feature ${id} has invalid ${column}`);
  }
}

function toDto(row: FeatureRow) {
  return {
    number: row.id,
    title: row.title,
    status: row.status,
    backlog: row.backlog === 1,
    priority: row.priority,
    state: row.state,
    description: row.plan,
    links: parseJson<Array<{ url: string; label?: string }>>(row.links_json, "links_json", row.id),
    owners: parseJson<string[]>(row.owners_json, "owners_json", row.id),
    statusHistory: parseJson<StatusChange[]>(row.status_history_json, "status_history_json", row.id),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

async function stages(db: D1Database, orgId: number): Promise<Stage[]> {
  const row = await db.prepare("SELECT data FROM config WHERE org_id = ? AND key = 'settings'").bind(orgId).first<{ data: string }>();
  if (!row) return DEFAULT_STAGES;
  const configured = (JSON.parse(row.data) as { boardStages?: unknown }).boardStages;
  return Array.isArray(configured) && configured.length ? configured as Stage[] : DEFAULT_STAGES;
}

async function readFeature(db: D1Database, scope: TicketScope, number: number) {
  return db.prepare(`SELECT ${COLUMNS} FROM features WHERE id = ? AND org_id = ? AND project_id = ?`)
    .bind(number, scope.orgId, scope.projectId).first<FeatureRow>();
}

export async function listFeatures(db: D1Database, scope: TicketScope, state = "open"): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  if (!["open", "closed", "all"].includes(state)) return fail("Invalid feature state", 400);
  const statement = state === "all"
    ? db.prepare(`SELECT ${COLUMNS} FROM features WHERE org_id = ? AND project_id = ? ORDER BY id ASC`).bind(scope.orgId, scope.projectId)
    : db.prepare(`SELECT ${COLUMNS} FROM features WHERE org_id = ? AND project_id = ? AND state = ? ORDER BY id ASC`).bind(scope.orgId, scope.projectId, state);
  const { results = [] } = await statement.all<FeatureRow>();
  return ok(results.map(toDto));
}

export async function createFeature(db: D1Database, scope: TicketScope, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid feature", 400);
  const board = await stages(db, scope.orgId);
  const status = parsed.data.status ?? board[0].id;
  if (!board.some((stage) => stage.id === status)) return fail(`Invalid status: ${status}`, 422);
  const createdAt = now();
  const row = await db.prepare(`INSERT INTO features (org_id, project_id, title, status, backlog, priority, plan, links_json, owners_json, status_history_json, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)
    .bind(
      scope.orgId, scope.projectId, parsed.data.title, status, parsed.data.backlog ? 1 : 0, parsed.data.priority ?? 3, parsed.data.description ?? "", JSON.stringify(parsed.data.links ?? []),
      JSON.stringify(parsed.data.owners ?? []), JSON.stringify([{ status, at: createdAt }]), scope.userLogin, createdAt, createdAt,
    ).first<FeatureRow>();
  if (!row) throw new Error("Feature insert returned no row");
  return ok(toDto(row), 201);
}

export async function updateFeature(db: D1Database, scope: TicketScope, number: number, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  if (!Number.isInteger(number) || number <= 0) return fail("Invalid feature number", 400);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid feature", 400);
  const patch = parsed.data;
  const current = await readFeature(db, scope, number);
  if (!current) return fail("Feature not found", 404);

  const updatedAt = now();
  const sets: string[] = ["updated_at = ?"];
  const binds: Array<string | number | null> = [updatedAt];
  if (patch.title !== undefined) { sets.push("title = ?"); binds.push(patch.title); }
  if (patch.description !== undefined) { sets.push("plan = ?"); binds.push(patch.description); }
  if (patch.links !== undefined) { sets.push("links_json = ?"); binds.push(JSON.stringify(patch.links)); }
  if (patch.backlog !== undefined) { sets.push("backlog = ?"); binds.push(patch.backlog ? 1 : 0); }
  if (patch.priority !== undefined) { sets.push("priority = ?"); binds.push(patch.priority); }
  if (patch.owners !== undefined) { sets.push("owners_json = ?"); binds.push(JSON.stringify(patch.owners)); }
  if (patch.state !== undefined && patch.state !== current.state) {
    sets.push("state = ?", "closed_at = ?");
    binds.push(patch.state, patch.state === "closed" ? updatedAt : null);
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    const board = await stages(db, scope.orgId);
    if (!board.some((stage) => stage.id === patch.status)) return fail(`Invalid status: ${patch.status}`, 422);
    const history = parseJson<StatusChange[]>(current.status_history_json, "status_history_json", current.id);
    sets.push("status = ?", "status_history_json = ?");
    binds.push(patch.status, JSON.stringify([...history, { status: patch.status, at: updatedAt }]));
  }

  const row = await db.prepare(`UPDATE features SET ${sets.join(", ")} WHERE id = ? AND org_id = ? AND project_id = ? RETURNING ${COLUMNS}`)
    .bind(...binds, number, scope.orgId, scope.projectId).first<FeatureRow>();
  return row ? ok(toDto(row)) : fail("Feature not found", 404);
}
