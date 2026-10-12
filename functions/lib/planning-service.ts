export interface PlanningScope {
  orgId: number;
  projectId?: string | null;
  userLogin: string;
  isAdmin?: boolean;
}

export interface PlanningServiceResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

export interface PlanningServiceBinding {
  listSpecs(scope: PlanningScope, filters?: { featureNumber?: number | "unfiled"; includeArchived?: boolean }): Promise<PlanningServiceResult>;
  getSpec(scope: PlanningScope, id: number): Promise<PlanningServiceResult>;
  createSpec(scope: PlanningScope, input: unknown): Promise<PlanningServiceResult>;
  updateSpec(scope: PlanningScope, id: number, input: unknown): Promise<PlanningServiceResult>;
  setSpecArchived(scope: PlanningScope, id: number, archived: boolean): Promise<PlanningServiceResult>;
  listAttachments(scope: PlanningScope, specId: number): Promise<PlanningServiceResult>;
  putAttachment(scope: PlanningScope, specId: number, filename: string, bytes: ArrayBuffer): Promise<PlanningServiceResult>;
  getAttachment(scope: PlanningScope, specId: number, attachmentId: number): Promise<Response>;
  deleteAttachment(scope: PlanningScope, specId: number, attachmentId: number): Promise<PlanningServiceResult>;
  listFeatures(scope: PlanningScope, state?: string): Promise<PlanningServiceResult>;
  createFeature(scope: PlanningScope, input: unknown): Promise<PlanningServiceResult>;
  updateFeature(scope: PlanningScope, number: number, input: unknown): Promise<PlanningServiceResult>;
  listTasks(scope: PlanningScope, filters?: { owner?: string; status?: "open" | "completed" | "all"; featureNumber?: number | "general" }): Promise<PlanningServiceResult>;
  createTask(scope: PlanningScope, input: unknown): Promise<PlanningServiceResult>;
  updateTask(scope: PlanningScope, id: string, input: unknown): Promise<PlanningServiceResult>;
  deleteTask(scope: PlanningScope, id: string): Promise<PlanningServiceResult>;
  getTaskWorkflow(scope: PlanningScope, owner?: string): Promise<PlanningServiceResult>;
  putTaskWorkflow(scope: PlanningScope, owner: string, input: unknown): Promise<PlanningServiceResult>;
  listFeatureAttachments(scope: PlanningScope, featureId: number): Promise<PlanningServiceResult>;
  putFeatureAttachment(scope: PlanningScope, featureId: number, filename: string, bytes: ArrayBuffer): Promise<PlanningServiceResult>;
  getFeatureAttachment(scope: PlanningScope, featureId: number, attachmentId: number): Promise<Response>;
  deleteFeatureAttachment(scope: PlanningScope, featureId: number, attachmentId: number): Promise<PlanningServiceResult>;
  buildActivityMessage(input: unknown): Promise<{ text: string; blocks: unknown[]; client_msg_id?: string }>;
  buildFeatureAddedMessage(input: unknown): Promise<{ text: string; blocks: unknown[]; client_msg_id?: string }>;
  buildTestMessage(orgLogin: string): Promise<{ text: string; blocks: unknown[] }>;
}

export interface PlanningEnvironment {
  PLANNING_SERVICE?: PlanningServiceBinding;
  NOXHERE_LOCAL_MONOLITH?: string;
}

export function serviceResultResponse(result: PlanningServiceResult): Response {
  return Response.json(result.ok ? result.data : { error: result.error ?? "Planning request failed" }, {
    status: result.status,
  });
}

export async function callPlanning(
  env: PlanningEnvironment,
  operation: (binding: PlanningServiceBinding) => Promise<PlanningServiceResult>,
): Promise<Response | null> {
  if (env.NOXHERE_LOCAL_MONOLITH === "1" || !env.PLANNING_SERVICE) return null;
  try {
    return serviceResultResponse(await operation(env.PLANNING_SERVICE));
  } catch (error) {
    console.error(JSON.stringify({
      event: "planning_service_unavailable",
      error: error instanceof Error ? error.message : String(error),
    }));
    return Response.json({ error: "Planning is temporarily unavailable", code: "service_unavailable", service: "planning" }, { status: 503 });
  }
}
