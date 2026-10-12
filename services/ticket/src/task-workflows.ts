import { z } from "zod";
import type { ServiceResult, TicketScope } from "./specs";

export const GTD_TASK_STAGES = [
  { id: "inbox", label: "Inbox", color: "#94a3b8" },
  { id: "next-actions", label: "Next actions", color: "#6f88b8" },
  { id: "in-progress", label: "In progress", color: "#8b83b8" },
  { id: "waiting-for", label: "Waiting for", color: "#c79263" },
  { id: "someday-maybe", label: "Someday / Maybe", color: "#9a938d" },
  { id: "done", label: "Done", color: "#6e9970", completed: true },
] as const;

const loginSchema = z.string().regex(/^[A-Za-z0-9-]{1,39}$/, "Invalid owner login");
const stageSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, "Invalid task stage id"),
  label: z.string().trim().min(1, "Task stage labels cannot be empty").max(60, "Task stage labels are limited to 60 characters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Task stage colors must be six-digit hex colors"),
  completed: z.boolean().optional(),
}).strict();
const workflowSchema = z.object({ stages: z.array(stageSchema).min(2, "Use at least two task stages").max(10, "Use at most ten task stages") }).strict()
  .superRefine(({ stages }, context) => {
    if (new Set(stages.map((stage) => stage.id)).size !== stages.length) context.addIssue({ code: "custom", message: "Task stage ids must be unique" });
    if (stages.filter((stage) => stage.completed === true).length !== 1) context.addIssue({ code: "custom", message: "Choose exactly one stage that completes a task" });
  });

type TaskStage = z.infer<typeof stageSchema>;
interface WorkflowRow { owner_login: string; stages_json: string; updated_at: string }

const failure = (error: string, status: number): ServiceResult => ({ ok: false, status, error });
const success = <T>(data: T, status = 200): ServiceResult<T> => ({ ok: true, status, data });
const validScope = (scope: TicketScope) => Number.isInteger(scope?.orgId) && scope.orgId > 0 && typeof scope.projectId === "string" && scope.projectId.length > 0 && typeof scope.userLogin === "string" && scope.userLogin.length > 0;

function defaultWorkflow(owner: string) {
  return { owner, stages: GTD_TASK_STAGES.map((stage) => ({ ...stage })), source: "gtd-default" as const, updatedAt: null };
}

export async function getTaskWorkflow(db: D1Database, scope: TicketScope, owner = scope.userLogin): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  const parsedOwner = loginSchema.safeParse(owner);
  if (!parsedOwner.success) return failure(parsedOwner.error.issues[0]?.message ?? "Invalid owner login", 400);
  const row = await db.prepare("SELECT owner_login, stages_json, updated_at FROM task_workflows WHERE org_id = ? AND project_id = ? AND owner_login = ? COLLATE NOCASE")
    .bind(scope.orgId, scope.projectId, parsedOwner.data).first<WorkflowRow>();
  if (!row) return success(defaultWorkflow(parsedOwner.data));
  try {
    const stages = workflowSchema.parse({ stages: JSON.parse(row.stages_json) }).stages;
    return success({ owner: row.owner_login, stages, source: "custom", updatedAt: row.updated_at });
  } catch (error) {
    console.error(JSON.stringify({ event: "task_workflow_corrupt", orgId: scope.orgId, projectId: scope.projectId, owner: parsedOwner.data, error: error instanceof Error ? error.message : String(error) }));
    return failure("This personal task workflow is invalid and must be repaired", 500);
  }
}

export async function putTaskWorkflow(db: D1Database, scope: TicketScope, owner: string, input: unknown): Promise<ServiceResult> {
  if (!validScope(scope)) return failure("Missing organization, project or user scope", 400);
  const parsedOwner = loginSchema.safeParse(owner);
  if (!parsedOwner.success) return failure(parsedOwner.error.issues[0]?.message ?? "Invalid owner login", 400);
  if (parsedOwner.data.toLowerCase() !== scope.userLogin.toLowerCase()) return failure("You can only change your own task workflow", 403);
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid task workflow", 422);

  const timestamp = new Date().toISOString();
  const stages: TaskStage[] = parsed.data.stages;
  const completedStage = stages.find((stage) => stage.completed)!.id;
  const firstOpenStage = stages.find((stage) => !stage.completed)!.id;
  const stageIds = stages.map((stage) => stage.id);
  const placeholders = stageIds.map(() => "?").join(", ");
  await db.batch([
    db.prepare(`INSERT INTO task_workflows (org_id, project_id, owner_login, stages_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(org_id, project_id, owner_login) DO UPDATE SET stages_json = excluded.stages_json, updated_at = excluded.updated_at`)
      .bind(scope.orgId, scope.projectId, parsedOwner.data, JSON.stringify(stages), timestamp),
    db.prepare("UPDATE planning_tasks SET stage_id = ?, updated_at = ? WHERE org_id = ? AND project_id = ? AND owner_login = ? COLLATE NOCASE AND status = 'completed'")
      .bind(completedStage, timestamp, scope.orgId, scope.projectId, parsedOwner.data),
    db.prepare(`UPDATE planning_tasks SET stage_id = ?, position = 0, updated_at = ? WHERE org_id = ? AND project_id = ? AND owner_login = ? COLLATE NOCASE AND status = 'open' AND stage_id NOT IN (${placeholders})`)
      .bind(firstOpenStage, timestamp, scope.orgId, scope.projectId, parsedOwner.data, ...stageIds),
    db.prepare("UPDATE planning_tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE org_id = ? AND project_id = ? AND owner_login = ? COLLATE NOCASE AND status = 'open' AND stage_id = ?")
      .bind(timestamp, timestamp, scope.orgId, scope.projectId, parsedOwner.data, completedStage),
  ]);
  return success({ owner: parsedOwner.data, stages, source: "custom", updatedAt: timestamp });
}
