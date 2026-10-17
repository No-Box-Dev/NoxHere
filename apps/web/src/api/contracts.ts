import { z } from "zod";

const serviceIdSchema = z.enum(["connections", "planning", "activity", "feedback", "growth", "usage", "issues", "mail", "key"]);

const projectConnectionSchema = z.object({
  id: z.string(),
  provider: z.enum(["github", "slack"]),
  label: z.string(),
  status: z.enum(["connected", "attention"]),
});

export const githubMemberSchema = z.object({
  login: z.string(),
  avatar_url: z.string().url(),
  kind: z.enum(["human", "bot", "contributor"]).default("human"),
});

export const organizationMemberSchema = z.object({
  principalId: z.string(),
  login: z.string(),
  avatarUrl: z.string().nullable().optional().default(""),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  roleSource: z.enum(["github", "noxhere"]),
  verifiedAt: z.string(),
});
export const organizationMembersSchema = z.object({ members: z.array(organizationMemberSchema) });

export const projectSettingsSchema = z.object({
  branding: z.object({
    name: z.string(),
    logoUrl: z.string().nullable(),
    accentColor: z.string(),
    buttonText: z.string(),
    fontPreset: z.enum(["system", "playnist", "humanist", "editorial", "mono"]),
  }).optional(),
  excludedMembers: z.array(z.string()).optional(),
  boardStages: z.array(z.object({
    id: z.string(),
    label: z.string(),
    color: z.string(),
  })).optional(),
  taskBoardStages: z.array(z.object({
    id: z.string(),
    label: z.string(),
    color: z.string(),
    completed: z.boolean().optional(),
  })).optional(),
}).loose().nullable();

export const taskStageSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  completed: z.boolean().optional(),
});

export const taskWorkflowSchema = z.object({
  owner: z.string(),
  stages: z.array(taskStageSchema),
  source: z.enum(["gtd-default", "custom"]),
  updatedAt: z.string().nullable(),
});

export const slackRoutingSchema = z.object({
  routes: z.object({ planning: z.string().nullable() }).loose(),
  connections: z.object({ planning: z.string().nullable() }).loose().optional(),
  integrity: z.object({
    valid: z.boolean(),
    issues: z.array(z.object({
      route: z.string(),
      code: z.enum(["missing_workspace", "unknown_workspace"]),
    })),
  }).optional(),
}).loose();

export const slackStatusSchema = z.object({
  connected: z.boolean(),
  defaultConnectionId: z.string().nullable(),
  connections: z.array(z.object({
    id: z.string(),
    teamId: z.string(),
    teamName: z.string(),
    displayName: z.string().nullable().optional(),
    isDefault: z.boolean(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable().optional(),
    createdBy: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    connectedBy: z.string().nullable().optional(),
    connectedAt: z.string().nullable().optional(),
    lastUsedAt: z.string().nullable().optional(),
    health: z.string().optional(),
    lastCheckedAt: z.string().nullable().optional(),
    lastError: z.string().nullable().optional(),
    needsReconnect: z.boolean().optional(),
  }).loose()),
  canConfigure: z.boolean().optional(),
}).loose();

export const slackChannelsSchema = z.object({
  connectionId: z.string(),
  channels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    is_private: z.boolean(),
    is_archived: z.boolean(),
    is_member: z.boolean(),
  })),
});

export const slackMessageDeliverySchema = z.object({
  apiVersion: z.literal(1),
  delivery: z.object({
    status: z.literal("sent"),
    connectionId: z.string(),
    channelId: z.string(),
    messageTs: z.string(),
    sentAt: z.string(),
  }),
});

export type SlackMessagePayload = {
  text?: string;
  markdown_text?: string;
  blocks?: Record<string, unknown>[];
  attachments?: Record<string, unknown>[];
  metadata?: { event_type: string; event_payload: Record<string, unknown> };
  thread_ts?: string;
  reply_broadcast?: boolean;
  mrkdwn?: boolean;
  parse?: "none" | "full";
  link_names?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  client_msg_id?: string;
};

const guestInviteSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  scopeType: z.enum(["organization", "project", "tool"]),
  projectId: z.string().nullable(),
  projectName: z.string().nullable().optional(),
  service: z.enum(["planning", "activity", "feedback", "growth", "usage", "issues", "telemetry"]).nullable(),
  expiresAt: z.string().optional(),
  createdAt: z.string().optional(),
});

const guestGrantSchema = guestInviteSchema.omit({ expiresAt: true }).extend({ createdAt: z.string() });
export const guestInviteResponseSchema = z.object({ invitation: guestInviteSchema });

export const guestAccessSchema = z.object({
  grants: z.array(guestGrantSchema),
  invitations: z.array(guestInviteSchema),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  environment: z.enum(["production", "test"]),
  connections: z.array(projectConnectionSchema),
});

const projectDestinationSchema = z.object({ connectionId: z.string(), channelId: z.string() });
const projectRoutingSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean(),
  enabled: z.boolean(),
  repositories: z.array(z.string()),
  routes: z.object({
    activityPosts: projectDestinationSchema,
    activityReleaseNotes: projectDestinationSchema,
    telemetry: projectDestinationSchema,
    telemetryAlerts: projectDestinationSchema,
  }),
});
export const projectRoutingResponseSchema = z.object({
  projects: z.array(projectRoutingSchema),
  repositories: z.array(z.string()),
});

export const bootstrapSchema = z.object({
  actor: z.object({ id: z.string(), name: z.string(), initials: z.string(), accessLevel: z.enum(["member", "guest"]), role: z.enum(["owner", "admin", "member", "viewer", "guest"]).default("member"), capabilities: z.array(z.string()).default(["content.read", "content.write"]), isAdmin: z.boolean(), allowedServiceIds: z.array(serviceIdSchema) }),
  organization: z.object({ id: z.string(), name: z.string() }),
  projects: z.array(projectSchema),
});

const telemetryStatSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  context: z.string(),
  change: z.string(),
  direction: z.enum(["up", "down", "same"]),
  points: z.array(z.number()),
  breakdown: z.object({
    actionLabel: z.string(),
    windowDays: z.number().int().positive(),
    totalActions: z.number().nonnegative(),
    activeUsers: z.number().nonnegative(),
    participatingUsers: z.number().nonnegative(),
    participationRate: z.number().nonnegative(),
    actionsPerParticipant: z.number().nonnegative(),
  }).optional(),
});

export const telemetryDashboardSchema = z.object({
  range: z.string(),
  dateLabel: z.string(),
  reportStatus: z.string(),
  stats: z.array(telemetryStatSchema),
});

const growthMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().nonnegative(),
  points: z.array(z.number().nonnegative()),
});

export const growthDashboardSchema = z.object({
  projectId: z.string(),
  range: z.string(),
  dateLabel: z.string(),
  metrics: z.array(growthMetricSchema),
  funnel: z.object({
    visits: z.number().nonnegative(),
    signupIntents: z.number().nonnegative(),
    trials: z.number().nonnegative(),
    paid: z.number().nonnegative(),
    cancelled: z.number().nonnegative(),
    trialToPaidRate: z.number().nonnegative().nullable(),
  }),
});

export const growthEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number().positive(),
  subject: z.string().nullable(),
  environment: z.string(),
  occurredAt: z.string(),
});

const telemetryActionSchema = z.object({
  slot: z.number().int().min(1).max(3),
  key: z.string(),
  label: z.string(),
});

export const telemetryActionsSchema = z.object({
  projectId: z.string(),
  windowDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  actions: z.array(telemetryActionSchema).max(3),
  snippet: z.string(),
});

export const telemetryStatEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  subject: z.string(),
  environment: z.string(),
  receivedAt: z.string(),
  status: z.enum(["accepted", "rejected"]),
});

export const engineerStatsSchema = z.object({
  openPRs: z.record(z.string(), z.number()),
  openNonDraftPRs: z.record(z.string(), z.number()),
  reviewing: z.record(z.string(), z.number()),
  approvalsGiven: z.record(z.string(), z.number()),
  mergesOfOthers: z.record(z.string(), z.number()),
  assignedIssues: z.record(z.string(), z.number()),
  lifetimePRs: z.record(z.string(), z.number()),
  prsLast4Weeks: z.record(z.string(), z.number()),
  lifetimeCommits: z.record(z.string(), z.number()),
  commitsLast4Weeks: z.record(z.string(), z.number()),
  issuesClosed: z.record(z.string(), z.number()),
  coverage: z.object({
    approvalsGivenSince: z.string().nullable(), mergedByKnown: z.number(), mergedPRs: z.number(),
    issuesClosedByKnown: z.number(), closedIssues: z.number(),
  }),
  prAudits: z.record(z.string(), z.object({
    startMonth: z.string(), endMonth: z.string(), completedAt: z.string(),
    githubPRs: z.number(), cachedAllPRs: z.number(), cachedTrackedPRs: z.number(),
  })).default({}),
  freshness: z.object({
    repositories: z.number(), pullRequestsAt: z.string().nullable(), issuesAt: z.string().nullable(),
    commitsAt: z.string().nullable(), eventsAt: z.string().nullable(),
  }).optional(),
}).loose();

export const telemetryAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  environment: z.string(),
  summary: z.string(),
  status: z.enum(["active", "resolved"]),
  occurrences: z.number(),
  happenedAt: z.string(),
  diagnostics: z.object({
    eventId: z.string().nullable(),
    message: z.string().nullable(),
    url: z.string().nullable(),
    error: z.object({
      name: z.string().nullable(),
      message: z.string().nullable(),
      code: z.string().nullable(),
      status: z.number().nullable(),
      stack: z.string().nullable(),
    }),
    context: z.object({
      release: z.string().nullable(),
      runtime: z.string().nullable(),
      sdkVersion: z.string().nullable(),
    }),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  }).nullable().optional(),
});

export const telemetryAlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["feature", "error", "health"]),
  condition: z.string(),
  environment: z.string(),
  source: z.string(),
  enabled: z.boolean(),
});

export const retrievalResultSchema = z.object({
  id: z.string(),
  serviceId: serviceIdSchema,
  kind: z.string(),
  title: z.string(),
  context: z.string(),
  href: z.string().startsWith("/"),
});

const featureLinkSchema = z.object({
  url: z.string(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
});

export const planningFeatureSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  number: z.number(),
  title: z.string(),
  state: z.string(),
  status: z.string().optional(),
  backlog: z.boolean().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  owners: z.array(z.string()).optional(),
  description: z.string().optional(),
  plan: z.string().optional(),
  links: z.array(featureLinkSchema).optional(),
  specLinks: z.array(featureLinkSchema).optional(),
  statusHistory: z.array(z.object({ status: z.string().optional(), at: z.string().optional(), timestamp: z.string().optional() }).passthrough()).optional(),
  updatedAt: z.string().nullish(),
  body: z.string().nullish(),
  assignees: z.array(z.object({ login: z.string() }).passthrough()).default([]),
  labels: z.array(z.union([z.string(), z.object({ name: z.string() }).passthrough()])).default([]),
  html_url: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
}).passthrough();

export const planningFeatureAttachmentSchema = z.object({
  id: z.number(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  uploadedBy: z.string(),
  uploadedAt: z.string(),
  kind: z.enum(["image", "pdf"]),
});

export const planningTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  note: z.string(),
  owner: z.string(),
  createdBy: z.string(),
  color: z.enum(["gray", "blue", "purple", "green", "yellow", "orange", "red", "pink"]),
  status: z.enum(["open", "completed"]),
  featureNumber: z.number().int().positive().nullable(),
  stageId: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});

export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectRouting = z.infer<typeof projectRoutingSchema>;
export type ProjectRoutingResponse = z.infer<typeof projectRoutingResponseSchema>;
export type GuestInvite = z.infer<typeof guestInviteSchema>;
export type GuestAccess = z.infer<typeof guestAccessSchema>;
export type GithubMember = z.infer<typeof githubMemberSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type ProjectSettings = NonNullable<z.infer<typeof projectSettingsSchema>>;
export type EngineerStats = z.infer<typeof engineerStatsSchema>;
export type SlackRouting = z.infer<typeof slackRoutingSchema>;
export type SlackStatus = z.infer<typeof slackStatusSchema>;
export type SlackChannels = z.infer<typeof slackChannelsSchema>;
export type SlackMessageDelivery = z.infer<typeof slackMessageDeliverySchema>;
export type ServiceId = z.infer<typeof serviceIdSchema>;
export type TelemetryDashboard = z.infer<typeof telemetryDashboardSchema>;
export type GrowthDashboard = z.infer<typeof growthDashboardSchema>;
export type GrowthEvent = z.infer<typeof growthEventSchema>;
export type TelemetryAction = z.infer<typeof telemetryActionSchema>;
export type TelemetryActions = z.infer<typeof telemetryActionsSchema>;
export type TelemetryStat = z.infer<typeof telemetryStatSchema>;
export type TelemetryStatEvent = z.infer<typeof telemetryStatEventSchema>;
export type TelemetryAlert = z.infer<typeof telemetryAlertSchema>;
export type TelemetryAlertRule = z.infer<typeof telemetryAlertRuleSchema>;
export type RetrievalResult = z.infer<typeof retrievalResultSchema>;
export type PlanningFeatureRecord = z.infer<typeof planningFeatureSchema>;
export type PlanningTask = z.infer<typeof planningTaskSchema>;
export type TaskStage = z.infer<typeof taskStageSchema>;
export type TaskWorkflow = z.infer<typeof taskWorkflowSchema>;
export type PlanningFeatureAttachment = z.infer<typeof planningFeatureAttachmentSchema>;
