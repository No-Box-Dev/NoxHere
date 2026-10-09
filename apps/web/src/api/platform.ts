import { z } from "zod";
import { bootstrapSchema, cueActionsSchema, cueAlertRuleSchema, cueAlertSchema, cueDashboardSchema, cueStatEventSchema, engineerStatsSchema, githubMemberSchema, guestAccessSchema, guestInviteResponseSchema, planningTaskSchema, projectRoutingResponseSchema, projectSettingsSchema, retrievalResultSchema, slackChannelsSchema, slackMessageDeliverySchema, slackRoutingSchema, slackStatusSchema, ticketFeatureAttachmentSchema, ticketFeatureSchema } from "./contracts";
import type { Bootstrap, CueAction, CueActions, CueAlert, CueAlertRule, CueDashboard, CueStatEvent, EngineerStats, GithubMember, GuestAccess, GuestInvite, PlanningTask, Project, ProjectRouting, ProjectRoutingResponse, ProjectSettings, RetrievalResult, ServiceId, SlackChannels, SlackMessageDelivery, SlackMessagePayload, SlackRouting, SlackStatus, TicketFeatureAttachment, TicketFeatureRecord } from "./contracts";
import { deleteJson, getBlob, getJson, getRawJson, patchJson, postFormJson, postJson, postRawJson, putJson } from "./http";

export interface PlatformApi {
  bootstrap(organizationId: string, projectId: string, signal?: AbortSignal): Promise<Bootstrap>;
  createProject(organizationId: string, name: string, repositories?: string[]): Promise<{ id: string; name: string; repositories: string[] }>;
  projectRouting(organizationId: string, projectId: string, signal?: AbortSignal): Promise<ProjectRoutingResponse>;
  setProjectRouting(organizationId: string, project: ProjectRouting): Promise<void>;
  ticketFeatures(organizationId: string, projectId: string, signal?: AbortSignal): Promise<TicketFeatureRecord[]>;
  createTicketFeature(organizationId: string, projectId: string, input: { title: string; status?: string; backlog?: boolean; priority?: number; owners?: string[]; description?: string; links?: Array<{ url: string; label?: string }> }): Promise<TicketFeatureRecord>;
  updateTicketFeature(organizationId: string, projectId: string, featureId: number, input: { title?: string; status?: string; owners?: string[]; description?: string; links?: Array<{ url: string; label?: string }>; backlog?: boolean; priority?: number; state?: "open" | "closed" }): Promise<TicketFeatureRecord>;
  deleteTicketFeature(organizationId: string, projectId: string, featureId: number): Promise<void>;
  planningTasks(organizationId: string, projectId: string, signal?: AbortSignal): Promise<PlanningTask[]>;
  createPlanningTask(organizationId: string, projectId: string, input: { title: string; note?: string; owner?: string; color?: PlanningTask["color"]; featureNumber?: number | null; stageId?: string }): Promise<PlanningTask>;
  updatePlanningTask(organizationId: string, projectId: string, taskId: string, input: Partial<Pick<PlanningTask, "title" | "note" | "owner" | "color" | "status" | "featureNumber" | "stageId" | "position">>): Promise<PlanningTask>;
  deletePlanningTask(organizationId: string, projectId: string, taskId: string): Promise<void>;
  ticketFeatureAttachments(organizationId: string, projectId: string, featureId: number, signal?: AbortSignal): Promise<TicketFeatureAttachment[]>;
  uploadTicketFeatureAttachment(organizationId: string, projectId: string, featureId: number, file: File): Promise<TicketFeatureAttachment>;
  ticketFeatureAttachmentBlob(organizationId: string, projectId: string, featureId: number, attachmentId: number, signal?: AbortSignal): Promise<Blob>;
  deleteTicketFeatureAttachment(organizationId: string, projectId: string, featureId: number, attachmentId: number): Promise<void>;
  cueDashboard(organizationId: string, projectId: string, range: string, signal?: AbortSignal): Promise<CueDashboard>;
  cueActions(organizationId: string, projectId: string, signal?: AbortSignal): Promise<CueActions>;
  setCueActions(organizationId: string, projectId: string, actions: Array<Pick<CueAction, "key" | "label">>, windowDays: 7 | 14 | 30): Promise<CueActions>;
  cueStatEvents(organizationId: string, projectId: string, signal?: AbortSignal): Promise<CueStatEvent[]>;
  engineerStats(organizationId: string, projectId: string, signal?: AbortSignal): Promise<EngineerStats>;
  cueAlerts(organizationId: string, projectId: string, signal?: AbortSignal): Promise<CueAlert[]>;
  cueAlertRules(organizationId: string, projectId: string, signal?: AbortSignal): Promise<CueAlertRule[]>;
  retrieve(projectId: string, query: string, signal?: AbortSignal): Promise<RetrievalResult[]>;
  guestAccess(organizationId: string, signal?: AbortSignal): Promise<GuestAccess>;
  inviteGuest(organizationId: string, projectId: string, email: string, serviceId: "all" | "ticket" | "feed" | "spot" | "cue"): Promise<GuestInvite>;
  members(organizationId: string, projectId: string, signal?: AbortSignal): Promise<GithubMember[]>;
  projectSettings(organizationId: string, projectId: string, signal?: AbortSignal): Promise<ProjectSettings>;
  setProjectSettings(organizationId: string, projectId: string, settings: ProjectSettings): Promise<ProjectSettings>;
  slackRouting(organizationId: string, projectId: string, signal?: AbortSignal): Promise<SlackRouting>;
  slackStatus(organizationId: string, projectId: string, signal?: AbortSignal): Promise<SlackStatus>;
  slackChannels(organizationId: string, projectId: string, connectionId: string, signal?: AbortSignal): Promise<SlackChannels>;
  sendSlackMessage(organizationId: string, projectId: string, connectionId: string, channelId: string, message: SlackMessagePayload): Promise<SlackMessageDelivery>;
  setNoxTicketSlackChannel(organizationId: string, projectId: string, connectionId: string | null, channelId: string | null): Promise<SlackRouting>;
  testNoxTicketSlackChannel(organizationId: string, projectId: string, connectionId: string, channelId: string): Promise<void>;
}

export const projectSettingsQueryKey = (organizationId: string, projectId: string) => ["platform", "project-settings", organizationId, projectId] as const;

export const platformApi: PlatformApi = {
  bootstrap: async (organizationId, projectId, signal) => {
    const scope = { organizationId, projectId };
    const [profileRaw, projectsRaw, membersRaw, connectionsRaw] = await Promise.all([
      getRawJson("/api/v1/me", signal, scope),
      getRawJson("/api/v1/projects?view=bootstrap", signal, scope),
      getRawJson("/api/v1/members", signal, scope).catch(() => []),
      getRawJson("/api/v1/integrations/connections?view=bootstrap", signal, scope).catch(() => null),
    ]);
    const profile = profileRaw as { login?: string; org?: string; accessLevel?: "member" | "guest"; isAdmin?: boolean; allowedServices?: string[] };
    const projectRows = (projectsRaw as { projects?: Array<{ id: string; name: string; org?: string | null; repo?: string | null; repositories?: string[]; description?: string | null; archived?: number; routing_enabled?: number }> }).projects ?? [];
    const memberRows = Array.isArray(membersRaw) ? membersRaw as Array<{ login?: string | null; avatar_url?: string | null; kind?: string | null }> : [];
    const members: Project["members"] = memberRows.flatMap((member) => member.kind === "human" && member.login && member.avatar_url
      ? [{ login: member.login, avatarUrl: member.avatar_url, role: profile.isAdmin && member.login.toLowerCase() === profile.login?.toLowerCase() ? "admin" as const : "member" as const }]
      : []);
    const integration = connectionsRaw as { github?: { connected?: boolean }; slack?: { connected?: boolean; teamName?: string | null } } | null;
    const guestServices = profile.accessLevel === "guest" ? new Set((profile.allowedServices ?? []).flatMap((id) => {
      const mapped = ({ noxticket: ["ticket"], noxfeed: ["feed"], noxspot: ["spot"], noxcue: ["stats", "incidents"] } as Record<string, ServiceId[] | undefined>)[id];
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
        connections, members: [...members],
      }];
    });
    const login = profile.login ?? "Member";
    return bootstrapSchema.parse({
      actor: { id: login, name: login, initials: login.slice(0, 2).toUpperCase(), accessLevel: profile.accessLevel ?? "member", isAdmin: Boolean(profile.isAdmin), allowedServiceIds: guestServices ? [...guestServices] : [] },
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
  ticketFeatures: async (organizationId, projectId, signal) => {
    return getJson("/api/v1/features?state=all", ticketFeatureSchema.array(), signal, { organizationId, projectId });
  },
  createTicketFeature: (organizationId, projectId, input) => postJson("/api/v1/features", input, ticketFeatureSchema, { organizationId, projectId }),
  updateTicketFeature: (organizationId, projectId, featureId, input) => patchJson(`/api/v1/features/${featureId}`, input, ticketFeatureSchema, { organizationId, projectId }),
  deleteTicketFeature: async (organizationId, projectId, featureId) => {
    await deleteJson(`/api/v1/features/${featureId}`, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
  planningTasks: (organizationId, projectId, signal) => getJson("/api/v1/tasks?status=all", planningTaskSchema.array(), signal, { organizationId, projectId }),
  createPlanningTask: (organizationId, projectId, input) => postJson("/api/v1/tasks", input, planningTaskSchema, { organizationId, projectId }),
  updatePlanningTask: (organizationId, projectId, taskId, input) => patchJson(`/api/v1/tasks/${encodeURIComponent(taskId)}`, input, planningTaskSchema, { organizationId, projectId }),
  deletePlanningTask: async (organizationId, projectId, taskId) => {
    await deleteJson(`/api/v1/tasks/${encodeURIComponent(taskId)}`, z.object({ ok: z.literal(true) }), { organizationId, projectId });
  },
  ticketFeatureAttachments: async (organizationId, projectId, featureId, signal) => {
    const result = await getJson(`/api/v1/features/${featureId}/attachments`, z.object({ attachments: ticketFeatureAttachmentSchema.array() }), signal, { organizationId, projectId });
    return result.attachments;
  },
  uploadTicketFeatureAttachment: (organizationId, projectId, featureId, file) => {
    const form = new FormData();
    form.set("file", file);
    return postFormJson(`/api/v1/features/${featureId}/attachments`, form, ticketFeatureAttachmentSchema, { organizationId, projectId });
  },
  ticketFeatureAttachmentBlob: (organizationId, projectId, featureId, attachmentId, signal) => getBlob(`/api/v1/features/${featureId}/attachments/${attachmentId}`, signal, { organizationId, projectId }),
  deleteTicketFeatureAttachment: async (organizationId, projectId, featureId, attachmentId) => {
    await deleteJson(`/api/v1/features/${featureId}/attachments/${attachmentId}`, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
  cueDashboard: (organizationId, projectId, range, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/dashboard?range=${encodeURIComponent(range)}`, cueDashboardSchema, signal, { organizationId, projectId }),
  cueActions: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/actions`, cueActionsSchema, signal, { organizationId, projectId }),
  setCueActions: (organizationId, projectId, actions, windowDays) => putJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/actions`, { actions, windowDays }, cueActionsSchema, { organizationId, projectId }),
  cueStatEvents: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/stat-events`, cueStatEventSchema.array(), signal, { organizationId, projectId }),
  engineerStats: (organizationId, projectId, signal) => getJson("/api/v1/engineer-stats", engineerStatsSchema, signal, { organizationId, projectId }),
  cueAlerts: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/alerts`, cueAlertSchema.array(), signal, { organizationId, projectId }),
  cueAlertRules: (organizationId, projectId, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/cue/alert-rules`, cueAlertRuleSchema.array(), signal, { organizationId, projectId }),
  retrieve: (projectId, query, signal) => getJson(`/api/v1/projects/${encodeURIComponent(projectId)}/retrieval?q=${encodeURIComponent(query)}`, retrievalResultSchema.array(), signal, { projectId }),
  guestAccess: (organizationId, signal) => getJson("/api/v1/guests", guestAccessSchema, signal, { organizationId }),
  inviteGuest: async (organizationId, projectId, email, serviceId) => {
    const service = serviceId === "all" ? null : ({ ticket: "noxticket", feed: "noxfeed", spot: "noxspot", cue: "noxcue" } as const)[serviceId];
    const response = await postJson("/api/v1/guests/invites", { email, scopeType: service ? "tool" : "project", projectId, service }, guestInviteResponseSchema, { organizationId });
    return response.invitation;
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
  setNoxTicketSlackChannel: (organizationId, projectId, connectionId, channelId) => patchJson("/api/v1/integrations/slack/routing", { routes: { noxticket: channelId }, connections: { noxticket: connectionId } }, slackRoutingSchema, { organizationId, projectId }),
  testNoxTicketSlackChannel: async (organizationId, projectId, connectionId, channelId) => {
    await postJson("/api/v1/slack/test", { connectionId, channelId, kind: "noxticket" }, z.object({ ok: z.literal(true) }).loose(), { organizationId, projectId });
  },
};
