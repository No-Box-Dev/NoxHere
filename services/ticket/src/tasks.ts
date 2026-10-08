import { z } from "zod";
import type { ServiceResult, TicketScope } from "./specs";

export const TASK_COLORS = ["gray", "blue", "purple", "green", "yellow", "orange", "red", "pink"] as const;

const loginSchema = z.string().regex(/^[A-Za-z0-9-]{1,39}$/, "Invalid owner login");
const stageSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, "Invalid task stage");
const createSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "Title too long (max 200)"),
  note: z.string().max(4000, "Note too long (max 4000)").optional(),
  owner: loginSchema.optional(),
  color: z.enum(TASK_COLORS).optional(),
  featureNumber: z.number().int().positive().nullable().optional(),
  stageId: stageSchema.optional(),
  position: z.number().int().min(0).optional(),
}).strict();
const updateSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "Title too long (max 200)").optional(),
  note: z.string().max(4000, "Note too long (max 4000)").optional(),
  owner: loginSchema.optional(),
  color: z.enum(TASK_COLORS).optional(),
  status: z.enum(["open", "completed"]).optional(),
  featureNumber: z.number().int().positive().nullable().optional(),
  stageId: stageSchema.optional(),
  position: z.number().int().min(0).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export interface TaskFilters { owner?: string; status?: "open" | "completed" | "all"; featureNumber?: number | "general" }
interface TaskRow {
  id: string; title: string; note: string; owner_login: string; created_by: string; color: typeof TASK_COLORS[number];
  status: "open" | "completed"; feature_id: number | null; stage_id: string; position: number; created_at: string; updated_at: string; completed_at: string | null;
}
const COLUMNS = "id, title, note, owner_login, created_by, color, status, feature_id, stage_id, position, created_at, updated_at, completed_at";
const fail = (error: string, status: number): ServiceResult => ({ ok: false, status, error });
const ok = <T>(data: T, status = 200): ServiceResult<T> => ({ ok: true, status, data });
const now = () => new Date().toISOString();
const validScope = (scope: TicketScope) => Number.isInteger(scope?.orgId) && scope.orgId > 0 && typeof scope.projectId === "string" && scope.projectId.length > 0 && typeof scope.userLogin === "string" && scope.userLogin.length > 0;
const toDto = (row: TaskRow) => ({ id: row.id, title: row.title, note: row.note, owner: row.owner_login, createdBy: row.created_by, color: row.color, status: row.status, featureNumber: row.feature_id, stageId: row.stage_id, position: row.position, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at });

async function featureExists(db: D1Database, scope: TicketScope, featureNumber: number) {
  return Boolean(await db.prepare("SELECT 1 AS found FROM features WHERE id = ? AND org_id = ? AND project_id = ?").bind(featureNumber, scope.orgId, scope.projectId).first());
}

export async function listTasks(db: D1Database, scope: TicketScope, filters: TaskFilters = {}): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  if (filters.owner && !loginSchema.safeParse(filters.owner).success) return fail("Invalid owner login", 400);
  const status = filters.status ?? "all";
  if (!["open", "completed", "all"].includes(status)) return fail("Invalid task status", 400);
  const where = ["org_id = ?", "project_id = ?"];
  const binds: Array<string | number> = [scope.orgId, scope.projectId!];
  if (filters.owner) { where.push("owner_login = ?"); binds.push(filters.owner); }
  if (status !== "all") { where.push("status = ?"); binds.push(status); }
  if (filters.featureNumber === "general") where.push("feature_id IS NULL");
  else if (typeof filters.featureNumber === "number") { where.push("feature_id = ?"); binds.push(filters.featureNumber); }
  const { results = [] } = await db.prepare(`SELECT ${COLUMNS} FROM planning_tasks WHERE ${where.join(" AND ")} ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, position ASC, created_at ASC`).bind(...binds).all<TaskRow>();
  return ok(results.map(toDto));
}

export async function createTask(db: D1Database, scope: TicketScope, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid task", 400);
  if (parsed.data.featureNumber && !(await featureExists(db, scope, parsed.data.featureNumber))) return fail("Feature not found", 422);
  const timestamp = now();
  const row = await db.prepare(`INSERT INTO planning_tasks (id, org_id, project_id, title, note, owner_login, created_by, color, feature_id, stage_id, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)
    .bind(crypto.randomUUID(), scope.orgId, scope.projectId, parsed.data.title, parsed.data.note ?? "", parsed.data.owner ?? scope.userLogin, scope.userLogin, parsed.data.color ?? "gray", parsed.data.featureNumber ?? null, parsed.data.stageId ?? "todo", parsed.data.position ?? 0, timestamp, timestamp).first<TaskRow>();
  if (!row) throw new Error("Task insert returned no row");
  return ok(toDto(row), 201);
}

export async function updateTask(db: D1Database, scope: TicketScope, id: string, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  if (!z.uuid().safeParse(id).success) return fail("Invalid task id", 400);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid task", 400);
  const current = await db.prepare(`SELECT ${COLUMNS} FROM planning_tasks WHERE id = ? AND org_id = ? AND project_id = ?`).bind(id, scope.orgId, scope.projectId).first<TaskRow>();
  if (!current) return fail("Task not found", 404);
  if (!scope.isAdmin && current.owner_login.toLowerCase() !== scope.userLogin.toLowerCase() && current.created_by.toLowerCase() !== scope.userLogin.toLowerCase()) return fail("Only the owner, creator, or an administrator can change this task", 403);
  if (parsed.data.featureNumber && !(await featureExists(db, scope, parsed.data.featureNumber))) return fail("Feature not found", 422);
  const timestamp = now();
  const sets = ["updated_at = ?"];
  const binds: Array<string | number | null> = [timestamp];
  const patch = parsed.data;
  if (patch.title !== undefined) { sets.push("title = ?"); binds.push(patch.title); }
  if (patch.note !== undefined) { sets.push("note = ?"); binds.push(patch.note); }
  if (patch.owner !== undefined) { sets.push("owner_login = ?"); binds.push(patch.owner); }
  if (patch.color !== undefined) { sets.push("color = ?"); binds.push(patch.color); }
  if (patch.position !== undefined) { sets.push("position = ?"); binds.push(patch.position); }
  if (patch.featureNumber !== undefined) { sets.push("feature_id = ?"); binds.push(patch.featureNumber); }
  if (patch.stageId !== undefined) { sets.push("stage_id = ?"); binds.push(patch.stageId); }
  if (patch.status !== undefined) { sets.push("status = ?", "completed_at = ?"); binds.push(patch.status, patch.status === "completed" ? timestamp : null); }
  const row = await db.prepare(`UPDATE planning_tasks SET ${sets.join(", ")} WHERE id = ? AND org_id = ? AND project_id = ? RETURNING ${COLUMNS}`).bind(...binds, id, scope.orgId, scope.projectId).first<TaskRow>();
  return row ? ok(toDto(row)) : fail("Task not found", 404);
}

export async function deleteTask(db: D1Database, scope: TicketScope, id: string): Promise<ServiceResult> {
  if (!validScope(scope)) return fail("Missing organization, project or user scope", 400);
  if (!z.uuid().safeParse(id).success) return fail("Invalid task id", 400);
  const current = await db.prepare(`SELECT ${COLUMNS} FROM planning_tasks WHERE id = ? AND org_id = ? AND project_id = ?`).bind(id, scope.orgId, scope.projectId).first<TaskRow>();
  if (!current) return fail("Task not found", 404);
  if (!scope.isAdmin && current.owner_login.toLowerCase() !== scope.userLogin.toLowerCase() && current.created_by.toLowerCase() !== scope.userLogin.toLowerCase()) return fail("Only the owner, creator, or an administrator can delete this task", 403);
  await db.prepare("DELETE FROM planning_tasks WHERE id = ? AND org_id = ? AND project_id = ?").bind(id, scope.orgId, scope.projectId).run();
  return ok({ ok: true });
}
