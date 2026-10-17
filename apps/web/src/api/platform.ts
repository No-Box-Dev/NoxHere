import { z } from "zod";
import { bootstrapSchema, growthDashboardSchema, growthEventSchema, telemetryActionsSchema, telemetryAlertRuleSchema, telemetryAlertSchema, telemetryDashboardSchema, telemetryStatEventSchema, engineerStatsSchema, githubMemberSchema, guestAccessSchema, guestInviteResponseSchema, organizationMembersSchema, planningTaskSchema, projectRoutingResponseSchema, projectSettingsSchema, retrievalResultSchema, slackChannelsSchema, slackMessageDeliverySchema, slackRoutingSchema, slackStatusSchema, taskWorkflowSchema, planningFeatureAttachmentSchema, planningFeatureSchema } from "./contracts";
import type { Bootstrap, GrowthDashboard, GrowthEvent, TelemetryAction, TelemetryActions, TelemetryAlert, TelemetryAlertRule, TelemetryDashboard, TelemetryStatEvent, EngineerStats, GithubMember, GuestAccess, GuestInvite, OrganizationMember, PlanningTask, Project, ProjectRouting, ProjectRoutingResponse, ProjectSettings, RetrievalResult, ServiceId, SlackChannels, SlackMessageDelivery, SlackMessagePayload, SlackRouting, SlackStatus, TaskStage, TaskWorkflow, PlanningFeatureAttachment, PlanningFeatureRecord } from "./contracts";
import { deleteJson, getBlob, getJson, getRawJson, patchJson, postFormJson, postJson, postRawJson, putJson } from "./http";

export interface PlatformApi {
  bootstrap(organizationId: string, projectId: string, signal?: AbortSignal): Promise<Bootstrap>;
  createProject(organizationId: string, name: string, repositories?: string[]): Promise<{ id: string; name: string; repositories: string[] }>;
  projectRouting(organizationId: string, projectId: string, signal?: AbortSignal): Promise<ProjectRoutingResponse>;
  setProjectRouting(organizationId: string, project: ProjectRouting): Promise<void>;
  planningFeatures(organizationId: string, projectId: string, signal?: AbortSignal): Promise<PlanningFeatureRecord[]>;
  createPlanningFeature(organizationId: string, projectId: string, input: { title: string; status?: string; backlog?: boolean; priority?: number; owners?: string[]; description?: string; links?: Array<{ url: string; label?: string }> }): Promise<PlanningFeatureRecord>;
  updatePlanningFeature(organizationId: string, projectId: string, featureId: number, input: { title?: string; status?: string; owners?: string[]; description?: string; links?: Array<{ url: string; label?: string }>; backlog?: boolean; priority?: number; state?: "open" | "closed" }): Promise<PlanningFeatureRecord>;
  deletePlanningFeature(organizationId: string, projectId: string, featureId: number): Promise<void>;
  planningTasks(organizationId: string, projectId: string, signal?: AbortSignal): Promise<PlanningTask[]>;
  createPlanningTask(organizationId: string, projectId: string, input: { title: string; note?: string; owner?: string; color?: PlanningTask["color"]; featureNumber?: number | null; stageId?: string }): Promise<PlanningTask>;
  updatePlanningTask(organizationId: string, projectId: string, taskId: string, input: Partial<Pick<PlanningTask, "title" | "note" | "owner" | "color" | "status" | "featureNumber" | "stageId" | "position">>): Promise<PlanningTask>;
  deletePlanningTask(organizationId: string, projectId: string, taskId: string): Promise<void>;
  taskWorkflow(organizationId: string, projectId: string, owner: string, signal?: AbortSignal): Promise<TaskWorkflow>;
  setTaskWorkflow(organizationId: string, projectId: string, owner: string, stages: TaskStage[]): Promise<TaskWorkflow>;
  planningFeatureAttachments(organizationId: string, projectId: string, featureId: number, signal?: AbortSignal): Promise<PlanningFeatureAttachment[]>;
  uploadPlanningFeatureAttachment(organizationId: string, projectId: string, featureId: number, file: File): Promise<PlanningFeatureAttachment>;
  planningFeatureAttachmentBlob(organizationId: string, projectId: string, featureId: number, attachmentId: number, signal?: AbortSignal): Promise<Blob>;
  deletePlanningFeatureAttachment(organizationId: string, projectId: string, featureId: number, attachmentId: number): Promise<void>;
  growthDashboard(organizationId: string, projectId: string, range: string, signal?: AbortSignal): Promise<GrowthDashboard>;
  growthEvents(organizationId: string, projectId: string, signal?: AbortSignal): Promise<GrowthEvent[]>;
  usageDashboard(organizationId: string, projectId: string, range: string, signal?: AbortSignal): Promise<TelemetryDashboard>;
  usageActions(organizationId: string, projectId: string, signal?: AbortSignal): Promise<TelemetryActions>;
  setUsageActions(organizationId: string, projectId: string, actions: Array<Pick<TelemetryAction, "key" | "label">>, windowDays: 7 | 14 | 30): Promise<TelemetryActions>;
  usageEvents(organizationId: string, projectId: string, signal?: AbortSignal): Promise<TelemetryStatEvent[]>;
  engineerStats(organizationId: string, projectId: string, signal?: AbortSignal): Promise<EngineerStats>;
  issueIncidents(organizationId: string, projectId: string, signal?: AbortSignal): Promise<TelemetryAlert[]>;
  issueAlertRules(organizationId: string, projectId: string, signal?: AbortSignal): Promise<TelemetryAlertRule[]>;
  retrieve(organizationId: string, projectId: string, query: string, signal?: AbortSignal): Promise<RetrievalResult[]>;
  guestAccess(organizationId: string, signal?: AbortSignal): Promise<GuestAccess>;
  inviteGuest(organizationId: string, projectId: string, email: string, serviceId: "all" | "planning" | "activity" | "feedback" | "growth" | "usage" | "issues"): Promise<GuestInvite>;
  revokeGuest(organizationId: string, kind: "invites" | "grants", id: string): Promise<void>;
  resendGuestInvite(organizationId: string, id: string): Promise<void>;
  setGuestScope(organizationId: string, projectId: string, kind: "invites" | "grants", id: string, serviceId: "all" | "planning" | "activity" | "feedback" | "growth" | "usage" | "issues"): Promise<void>;
  organizationMembers(organizationId: string, signal?: AbortSignal): Promise<OrganizationMember[]>;
  setMemberRole(organizationId: string, principalId: string, role: "admin" | "member" | "viewer"): Promise<void>;
  auditLog(organizationId: string, signal?: AbortSignal): Promise<Array<{ id: number; actorType: string; actorId: string; action: string; targetId: string | null; createdAt: string }>>;
  members(organizationId: string, projectId: string, signal?: AbortSignal): Promise<GithubMember[]>;
  projectSettings(organizationId: string, projectId: string, signal?: AbortSignal): Promise<ProjectSettings>;
  setProjectSettings(organizationId: string, projectId: string, settings: ProjectSettings): Promise<ProjectSettings>;
  slackRouting(organizationId: string, projectId: string, signal?: AbortSignal): Promise<SlackRouting>;
  slackStatus(organizationId: string, projectId: string, signal?: AbortSignal): Promise<SlackStatus>;
  slackChannels(organizationId: string, projectId: string, connectionId: string, signal?: AbortSignal): Promise<SlackChannels>;
  sendSlackMessage(organizationId: string, projectId: string, connectionId: string, channelId: string, message: SlackMessagePayload): Promise<SlackMessageDelivery>;
  setPlanningSlackChannel(organizationId: string, projectId: string, connectionId: string | null, channelId: string | null): Promise<SlackRouting>;
  testPlanningSlackChannel(organizationId: string, projectId: string, connectionId: string, channelId: string): Promise<void>;
}

export const projectSettingsQueryKey = (organizationId: string, projectId: string) => ["platform", "project-settings", organizationId, projectId] as const;

export const platformApi: PlatformApi = {
  bootstrap: async (organizationId, projectId, signal) => {
    const scope = { organizationId, projectId };
    const [profileRaw, projectsRaw, connectionsRaw] = await Promise.all([
      getRawJson("/api/v1/me", signal, scope),
      getRawJson("/api/v1/projects?view=bootstrap", signal, scope),
      getRawJson("/api/v1/integrations/connections?view=bootstrap", signal, scope).catch(() => null),
    ]);
    const profile = profileRaw as { login?: string; org?: string; accessLevel?: "member" | "guest"; role?: "owner" | "admin" | "member" | "viewer" | "guest"; capabilities?: string[]; isAdmin?: boolean; allowedServices?: string[] };
    const projectRows = (projectsRaw as { projects?: Array<{ id: string; name: string; org?: string | null; repo?: string | null; repositories?: string[]; description?: string | null; archived?: number; routing_enabled?: number }> }).projects ?? [];
    const integration = connectionsRaw as { github?: { connected?: boolean }; slack?: { connected?: boolean; teamName?: string | null } } | null;
    const guestServices = profile.accessLevel === "guest" ? new Set((profile.allowedServices ?? []).flatMap((id) => {
      const mapped = ({ planning: ["planning"], activity: ["activity"], feedback: ["feedback"], growth: ["growth"], usage: ["usage"], issues: ["issues"], telemetry: ["growth", "usage", "issues"] } as Record<string, ServiceId[] | undefined>)[id];
      return mapped ?? [];
    })) : null;
    const projects: Project[] = projectRows.flatMap((row) => {
      if (row.archived === 1 || row.routing_enabled === 0) return [];
      const connections: Project["connections"] = [];
      const repositories = row.repositories?.length ? row.repositories : row.repo ? [row.repo] : [];
      repositories.forEach((repo) => connections.push({ id: `github-${row.id}-${repo}`, provider: "github", label: `${row.org ?? organizationId}/${repo}`, status: integration?.github?.connected ? "connected" : "attention" }));
      if (integration?.slack?.connected) connections.push({ id: `slack-${row.id}`, provider: "slack", label: integration.slack.teamName ?? "Slack", status: "connected" });
      return [{
        id: row.id, name: row.name, organizationId,
        environment: row.description?.toLowerCase().includes("isolated project for safely testing") ? "test" as const : "production" as const,
        connections,
      }];
    });
    const login = profile.login ?? "Member";
    return bootstrapSchema.parse({
      actor: { id: login, name: login, initials: login.slice(0, 2).toUpperCase(), accessLevel: profile.accessLevel ?? "member", role: profile.role ?? (profile.accessLevel === "guest" ? "guest" : profile.isAdmin ? "admin" : "member"), capabilities: profile.capabilities ?? (profile.isAdmin ? ["organization.manage", "members.manage", "guests.manage", "connections.manage", "repositories.manage", "tokens.manage", "growth.configure", "usage.configure", "issues.configure", "planning.configure"] : ["content.read", "content.write"]), isAdmin: Boolean(profile.isAdmin), allowedServiceIds: guestServices ? [...guestServices] : [] },
      organization: { id: organizationId, name: profile.org ?? organizationId },
      projects,
    });
  },
  createProject: async (organizationId, name, repositories) => {
    const response = await postRawJson<{ project?: { id?: unknown; name?: unknown; repositories?: unknown } }>("/api/v1/projects", { name, ...(repositories ? { repositories } : {}) }, { organizationId });
    if (typeof response.project?.id !== "string" || typeof response.project.name !== "string") throw new Error("Project creation returned an invalid response");
    return { id: response.project.id, name: response.project.name, repositories: Array.isArray(response.project.repositories) ? response.project.repositories.filter((repo): repo is string => typeof repo === "string") : [] };
  },
  projectRouting: (organizationId, projectId, signal) => getJson("/api/v1/projects/routing", projectRoutingResponseSchema, signal, { organizationId, projectId }),
  setProjectRouting: async (organizationId, project) => {
    await putJson(`/api/v1/projects/${encodeURIComponent(project.id)}/routing`, { enabled: project.enabled, repositories: project.repositories, routes: project.routes }, z.object({ ok: z.literal(true) }).passthrough(), { organizationId, projectId: project.id });
  },
  planningFeatures: async (organizationId, projectId, signal) => {
    return getJson("/api/v1/features?state=all", planningFeatureSchema.array(), signal, { organizationId, projectId });
  },
  createPlanningFeature: (organizationId, projectId, input) => postJson("/api/v1/features", input, planningFeatureSchema, { organizationId, projectId }),
  updatePlanningFeature: (organizationId, projectId, featureId, input) => patchJson(`/api/v1/features/${featureId}`, input, planningFeatureSchema, { organizationId, projectId }),
  deletePlanningFeature: async (organizationId, projectId, featureId) => {
    await deleteJson(`/api/v1/features/${featureId}`, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
  planningTasks: (organizationId, projectId, signal) => getJson("/api/v1/tasks?status=all", planningTaskSchema.array(), signal, { organizationId, projectId }),
  createPlanningTask: (organizationId, projectId, input) => postJson("/api/v1/tasks", input, planningTaskSchema, { organizationId, projectId }),
  updatePlanningTask: (organizationId, projectId, taskId, input) => patchJson(`/api/v1/tasks/${encodeURIComponent(taskId)}`, input, planningTaskSchema, { organizationId, projectId }),
  deletePlanningTask: async (organizationId, projectId, taskId) => {
    await deleteJson(`/api/v1/tasks/${encodeURIComponent(taskId)}`, z.object({ ok: z.literal(true) }), { organizationId, projectId });
  },
  taskWorkflow: (organizationId, projectId, owner, signal) => getJson(`/api/v1/task-workflows?owner=${encodeURIComponent(owner)}`, taskWorkflowSchema, signal, { organizationId, projectId }),
  setTaskWorkflow: (organizationId, projectId, owner, stages) => putJson("/api/v1/task-workflows", { owner, stages }, taskWorkflowSchema, { organizationId, projectId }),
  planningFeatureAttachments: async (organizationId, projectId, featureId, signal) => {
    const result = await getJson(`/api/v1/features/${featureId}/attachments`, z.object({ attachments: planningFeatureAttachmentSchema.array() }), signal, { organizationId, projectId });
    return result.attachments;
  },
  uploadPlanningFeatureAttachment: (organizationId, projectId, featureId, file) => {
    const form = new FormData();
    form.set("file", file);
    return postFormJson(`/api/v1/features/${featureId}/attachments`, form, planningFeatureAttachmentSchema, { organizationId, projectId });
  },
  planningFeatureAttachmentBlob: (organizationId, projectId, featureId, attachmentId, signal) => getBlob(`/api/v1/features/${featureId}/attachments/${attachmentId}`, signal, { organizationId, projectId }),
  deletePlanningFeatureAttachment: async (organizationId, projectId, featureId, attachmentId) => {
    await deleteJson(`/api/v1/features/${featureId}/attachments/${attachmentId}`, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
  growthDashboard: (organizationId, projectId, range, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/growth/dashboard?range=${encodeURIComponent(range)}`, growthDashboardSchema, signal, { organizationId, projectId }),
  growthEvents: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/growth/events`, growthEventSchema.array(), signal, { organizationId, projectId }),
  usageDashboard: (organizationId, projectId, range, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/usage/dashboard?range=${encodeURIComponent(range)}`, telemetryDashboardSchema, signal, { organizationId, projectId }),
  usageActions: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/usage/actions`, telemetryActionsSchema, signal, { organizationId, projectId }),
  setUsageActions: (organizationId, projectId, actions, windowDays) => putJson(`/api/v1/projects/${encodeURIComponent(projectId)}/usage/actions`, { actions, windowDays }, telemetryActionsSchema, { organizationId, projectId }),
  usageEvents: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/usage/events`, telemetryStatEventSchema.array(), signal, { organizationId, projectId }),
  engineerStats: (organizationId, projectId, signal) => getJson("/api/v1/engineer-stats", engineerStatsSchema, signal, { organizationId, projectId }),
  issueIncidents: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/issues/alerts`, telemetryAlertSchema.array(), signal, { organizationId, projectId }),
  issueAlertRules: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/issues/alert-rules`, telemetryAlertRuleSchema.array(), signal, { organizationId, projectId }),
  retrieve: (organizationId, projectId, query, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/retrieval?q=${encodeURIComponent(query)}`, retrievalResultSchema.array(), signal, { organizationId, projectId }),
  guestAccess: (organizationId, signal) => getJson("/api/v1/guests", guestAccessSchema, signal, { organizationId }),
  inviteGuest: async (organizationId, projectId, email, serviceId) => {
    const service = serviceId === "all" ? null : serviceId;
    const response = await postJson("/api/v1/guests/invites", { email, scopeType: service ? "tool" : "project", projectId, service }, guestInviteResponseSchema, { organizationId });
    return response.invitation;
  },
  revokeGuest: async (organizationId, kind, id) => {
    const path = kind === "invites" ? `/api/v1/guests/invites/${encodeURIComponent(id)}` : `/api/v1/guests/grants/${encodeURIComponent(id)}`;
    await deleteJson(path, z.object({ revoked: z.literal(true) }), { organizationId });
  },
  resendGuestInvite: async (organizationId, id) => {
    await postJson(`/api/v1/guests/invites/${encodeURIComponent(id)}/resend`, {}, z.object({ resent: z.literal(true) }).loose(), { organizationId });
  },
  setGuestScope: async (organizationId, projectId, kind, id, serviceId) => {
    const service = serviceId === "all" ? null : serviceId;
    const path = kind === "invites" ? `/api/v1/guests/invites/${encodeURIComponent(id)}` : `/api/v1/guests/grants/${encodeURIComponent(id)}`;
    await patchJson(path, { scopeType: service ? "tool" : "project", projectId, service }, z.object({ updated: z.literal(true) }).loose(), { organizationId });
  },
  organizationMembers: async (organizationId, signal) => (await getJson("/api/v1/memberships", organizationMembersSchema, signal, { organizationId })).members,
  setMemberRole: async (organizationId, principalId, role) => {
    await patchJson(`/api/v1/memberships/${encodeURIComponent(principalId)}`, { role }, z.object({ updated: z.literal(true) }).loose(), { organizationId });
  },
  auditLog: async (organizationId, signal) => {
    const result = await getJson("/api/v1/audit-log", z.object({ events: z.array(z.object({ id: z.number(), actorType: z.string(), actorId: z.string(), action: z.string(), targetId: z.string().nullable(), createdAt: z.string() }).loose()) }), signal, { organizationId });
    return result.events;
  },
  members: (organizationId, projectId, signal) => getJson("/api/v1/members", githubMemberSchema.array(), signal, { organizationId, projectId }),
  projectSettings: async (organizationId, projectId, signal) => (await getJson("/api/v1/config/settings", projectSettingsSchema, signal, { organizationId, projectId })) ?? {},
  setProjectSettings: async (organizationId, projectId, settings) => {
    await putJson("/api/v1/config/settings", settings, z.object({ ok: z.literal(true) }), { organizationId, projectId });
    return settings;
  },
  slackRouting: (organizationId, projectId, signal) => getJson("/api/v1/integrations/slack/routing", slackRoutingSchema, signal, { organizationId, projectId }),
  slackStatus: (organizationId, projectId, signal) => getJson("/api/v1/slack/status", slackStatusSchema, signal, { organizationId, projectId }),
  slackChannels: (organizationId, projectId, connectionId, signal) => getJson(`/api/v1/slack/channels?connectionId=${encodeURIComponent(connectionId)}`, slackChannelsSchema, signal, { organizationId, projectId }),
  sendSlackMessage: (organizationId, projectId, connectionId, channelId, message) => postJson("/api/v1/integrations/slack/messages", { connectionId, channelId, message }, slackMessageDeliverySchema, { organizationId, projectId }),
  setPlanningSlackChannel: (organizationId, projectId, connectionId, channelId) => patchJson("/api/v1/integrations/slack/routing", { routes: { planning: channelId }, connections: { planning: connectionId } }, slackRoutingSchema, { organizationId, projectId }),
  testPlanningSlackChannel: async (organizationId, projectId, connectionId, channelId) => {
    await postJson("/api/v1/slack/test", { connectionId, channelId, kind: "planning" }, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
};
