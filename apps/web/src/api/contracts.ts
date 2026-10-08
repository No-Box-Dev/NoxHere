import { z } from "zod";

const serviceIdSchema = z.enum(["connect", "ticket", "feed", "spot", "cue", "mail", "key"]);

const projectConnectionSchema = z.object({
  id: z.string(),
  provider: z.enum(["github", "slack"]),
  label: z.string(),
  status: z.enum(["connected", "attention"]),
});

const projectMemberSchema = z.object({
  login: z.string(),
  avatarUrl: z.string().url(),
  role: z.enum(["admin", "member"]),
});

export const githubMemberSchema = z.object({
  login: z.string(),
  avatar_url: z.string().url(),
  kind: z.enum(["human", "bot", "contributor"]).default("human"),
});

export const projectSettingsSchema = z.object({
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
  })).optional(),
}).loose().nullable();

export const slackRoutingSchema = z.object({
  routes: z.object({ noxticket: z.string().nullable() }).loose(),
  connections: z.object({ noxticket: z.string().nullable() }).loose().optional(),
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
    teamName: z.string(),
    isDefault: z.boolean(),
    projectId: z.string().nullable(),
  }).loose()),
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
  service: z.enum(["noxticket", "noxfeed", "noxspot", "noxcue"]).nullable(),
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
  members: z.array(projectMemberSchema),
});

const projectDestinationSchema = z.object({ connectionId: z.string(), channelId: z.string() });
const projectRoutingSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean(),
  enabled: z.boolean(),
  repositories: z.array(z.string()),
  routes: z.object({
    noxfeedPosts: projectDestinationSchema,
    noxfeedReleaseNotes: projectDestinationSchema,
    noxCue: projectDestinationSchema,
    noxCueAlerts: projectDestinationSchema,
  }),
});
export const projectRoutingResponseSchema = z.object({
  projects: z.array(projectRoutingSchema),
  repositories: z.array(z.string()),
});

export const bootstrapSchema = z.object({
  actor: z.object({ id: z.string(), name: z.string(), initials: z.string(), accessLevel: z.enum(["member", "guest"]), isAdmin: z.boolean(), allowedServiceIds: z.array(serviceIdSchema) }),
  organization: z.object({ id: z.string(), name: z.string() }),
  projects: z.array(projectSchema),
});

const cueStatSchema = z.object({
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

export const cueDashboardSchema = z.object({
  range: z.string(),
  dateLabel: z.string(),
  reportStatus: z.string(),
  stats: z.array(cueStatSchema),
});

const cueActionSchema = z.object({
  slot: z.number().int().min(1).max(3),
  key: z.string(),
  label: z.string(),
});

export const cueActionsSchema = z.object({
  projectId: z.string(),
  windowDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  actions: z.array(cueActionSchema).max(3),
  snippet: z.string(),
});

export const cueStatEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  subject: z.string(),
  environment: z.string(),
  receivedAt: z.string(),
  status: z.enum(["accepted", "rejected"]),
});

export const cueAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  environment: z.string(),
  summary: z.string(),
  status: z.enum(["active", "resolved"]),
  occurrences: z.number(),
  happenedAt: z.string(),
});

export const cueAlertRuleSchema = z.object({
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

export const ticketFeatureSchema = z.object({
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

export const ticketFeatureAttachmentSchema = z.object({
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
export type ProjectSettings = NonNullable<z.infer<typeof projectSettingsSchema>>;
export type SlackRouting = z.infer<typeof slackRoutingSchema>;
export type SlackStatus = z.infer<typeof slackStatusSchema>;
export type SlackChannels = z.infer<typeof slackChannelsSchema>;
export type SlackMessageDelivery = z.infer<typeof slackMessageDeliverySchema>;
export type ServiceId = z.infer<typeof serviceIdSchema>;
export type CueDashboard = z.infer<typeof cueDashboardSchema>;
export type CueAction = z.infer<typeof cueActionSchema>;
export type CueActions = z.infer<typeof cueActionsSchema>;
export type CueStat = z.infer<typeof cueStatSchema>;
export type CueStatEvent = z.infer<typeof cueStatEventSchema>;
export type CueAlert = z.infer<typeof cueAlertSchema>;
export type CueAlertRule = z.infer<typeof cueAlertRuleSchema>;
export type RetrievalResult = z.infer<typeof retrievalResultSchema>;
export type TicketFeatureRecord = z.infer<typeof ticketFeatureSchema>;
export type PlanningTask = z.infer<typeof planningTaskSchema>;
export type TicketFeatureAttachment = z.infer<typeof ticketFeatureAttachmentSchema>;
