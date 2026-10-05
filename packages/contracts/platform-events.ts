import { z } from "zod";

export const PLATFORM_EVENT_SPEC_VERSION = 1 as const;
export const PLATFORM_EVENT_DATA_VERSION = 1 as const;
export const MAX_PLATFORM_EVENT_BYTES = 64_000;

const Identifier = z.string().trim().min(1).max(200);
const ProjectId = z.string().trim().min(1).max(160);
const DomainKey = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,5}$/).max(160);
const Sha256Identity = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const HttpUrl = z.string().url().max(3_000).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Expected an HTTP(S) URL");

const Source = z.object({
  component: DomainKey,
  sourceId: Identifier.optional(),
}).strict();

const Subject = z.object({
  type: DomainKey,
  id: Identifier,
}).strict();

const Actor = z.discriminatedUnion("type", [
  z.object({ type: z.literal("member"), id: Identifier }).strict(),
  z.object({ type: z.literal("github_user"), id: Identifier }).strict(),
  z.object({ type: z.literal("anonymous"), idHash: Sha256Identity.optional() }).strict(),
  z.object({ type: z.literal("system") }).strict(),
]);

const Context = z.object({
  environment: z.enum(["development", "preview", "staging", "production"]).optional(),
  release: z.string().trim().min(1).max(200).optional(),
  requestId: Identifier.optional(),
  url: HttpUrl.optional(),
}).strict();

const Message = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(2_000).optional(),
  severity: z.enum(["info", "warning", "error"]).optional(),
}).strict();

const BaseEvent = z.object({
  specVersion: z.literal(PLATFORM_EVENT_SPEC_VERSION),
  dataVersion: z.literal(PLATFORM_EVENT_DATA_VERSION),
  id: z.string().uuid(),
  orgId: z.number().int().positive(),
  projectId: ProjectId,
  source: Source,
  subject: Subject,
  actor: Actor.optional(),
  context: Context.optional(),
  message: Message.optional(),
  occurredAt: z.string().datetime({ offset: true }),
  idempotencyKey: Identifier,
  correlationId: Identifier.optional(),
  causationId: Identifier.optional(),
}).strict();

const Repository = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const Branch = z.string().trim().min(1).max(255);
const PullRequestData = z.object({
  repository: Repository,
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  url: HttpUrl,
  baseBranch: Branch,
  headBranch: Branch,
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  changedFiles: z.number().int().nonnegative().optional(),
}).strict();

const IssueCreatedData = z.object({
  repository: Repository,
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  url: HttpUrl,
  labels: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
}).strict();

const FeedbackCreatedData = z.object({
  category: z.enum(["bug", "idea", "question", "other"]),
  description: z.string().trim().min(1).max(16_000),
  screenshotAssetId: Identifier.optional(),
  notificationRequested: z.boolean().default(false),
}).strict();

const FeedbackReopenedData = z.object({
  reason: z.string().trim().min(1).max(2_000),
  responseId: Identifier.optional(),
  screenshotAssetId: Identifier.optional(),
}).strict();

const FeedbackResolvedData = z.object({
  summary: z.string().trim().min(1).max(4_000),
  resolutionSource: z.enum(["application", "api", "source_control"]),
  externalIssueNumber: z.number().int().positive().optional(),
}).strict();

const DiagnosticValue = z.union([
  z.string().max(1_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const DiagnosticAttributes = z.record(
  z.string().regex(/^[a-z][a-z0-9_.-]{0,119}$/i),
  DiagnosticValue,
).refine((value) => Object.keys(value).length <= 200, "At most 200 diagnostic attributes are allowed");
const SanitizedError = z.object({
  name: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2_000),
  code: z.string().trim().min(1).max(120).optional(),
  status: z.number().int().min(100).max(599).optional(),
}).strict();

const ErrorDetectedData = z.object({
  fingerprint: Identifier,
  errorCode: z.string().trim().min(1).max(120).optional(),
  component: z.string().trim().min(1).max(160).optional(),
  fatal: z.boolean().default(false),
  unhandled: z.boolean().default(false),
  durationMs: z.number().int().min(0).max(120_000).optional(),
  sanitizedError: SanitizedError.optional(),
  attributes: DiagnosticAttributes.optional(),
}).strict();

const IncidentOpenedData = z.object({
  incidentKey: Identifier,
  category: z.enum(["feature", "error", "endpoint"]),
  impact: z.string().trim().min(1).max(2_000),
  occurrenceCount: z.number().int().positive().default(1),
}).strict();

const IncidentResolvedData = z.object({
  incidentKey: Identifier,
  resolution: z.string().trim().min(1).max(4_000),
  durationMs: z.number().int().nonnegative().optional(),
}).strict();

const EmptyData = z.object({}).strict();
const ActivityRecordedData = z.object({
  metric: z.string().regex(/^custom\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){0,4}$/).max(120),
  value: z.number().finite().default(1),
  attributes: DiagnosticAttributes.optional(),
}).strict();

const CapabilityCompletedData = z.object({
  capability: DomainKey,
  outcome: z.enum(["success", "rejected", "failure"]),
  reason: z.string().trim().min(1).max(500).optional(),
  durationMs: z.number().int().min(0).max(120_000).optional(),
}).strict();

const DeliveryBase = z.object({
  commandId: Identifier,
  provider: z.enum(["slack", "github", "email"]),
  operation: DomainKey,
  route: DomainKey,
}).strict();
const DeliveryQueuedData = DeliveryBase;
const DeliveryDeliveredData = DeliveryBase.extend({
  providerReference: z.object({
    resourceType: DomainKey,
    resourceId: Identifier,
    url: HttpUrl.optional(),
  }).strict(),
  attempts: z.number().int().positive(),
}).strict();
const DeliveryFailedData = DeliveryBase.extend({
  errorCode: z.string().trim().min(1).max(120),
  retryable: z.boolean(),
  attempts: z.number().int().positive(),
}).strict();

function event<TType extends string, TData extends z.ZodType>(type: TType, data: TData) {
  return BaseEvent.extend({ type: z.literal(type), data }).strict();
}

const eventSchemas = [
  event("source_control.pull_request.opened", PullRequestData),
  event("source_control.pull_request.merged", PullRequestData),
  event("source_control.issue.created", IssueCreatedData),
  event("feedback.report.created", FeedbackCreatedData),
  event("feedback.report.reopened", FeedbackReopenedData),
  event("feedback.report.resolved", FeedbackResolvedData),
  event("reliability.error.detected", ErrorDetectedData),
  event("reliability.incident.opened", IncidentOpenedData),
  event("reliability.incident.resolved", IncidentResolvedData),
  event("engagement.user.registered", EmptyData),
  event("engagement.user.active", EmptyData),
  event("engagement.activity.recorded", ActivityRecordedData),
  event("capability.execution.completed", CapabilityCompletedData),
  event("delivery.notification.queued", DeliveryQueuedData),
  event("delivery.notification.delivered", DeliveryDeliveredData),
  event("delivery.notification.failed", DeliveryFailedData),
] as const;

export const PlatformEventSchema = z.discriminatedUnion("type", eventSchemas).superRefine((value, context) => {
  if (value.type.startsWith("engagement.") && !Sha256Identity.safeParse(value.subject.id).success) {
    context.addIssue({
      code: "custom",
      path: ["subject", "id"],
      message: "Engagement subjects must use a sha256: identity",
    });
  }
});

export type PlatformEvent = z.infer<typeof PlatformEventSchema>;
export type PlatformEventType = PlatformEvent["type"];

export const PLATFORM_EVENT_TYPES = eventSchemas.map((schema) => schema.shape.type.value) as readonly PlatformEventType[];

const FORBIDDEN_EVENT_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "bottoken",
  "apikey",
  "privatekey",
  "clientsecret",
  "password",
  "secret",
  "email",
  "reporteremail",
  "userid",
  "affecteduser",
]);

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function findForbiddenEventPaths(value: unknown, path = "$", found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenEventPaths(item, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_EVENT_KEYS.has(normalizedKey(key))) found.push(childPath);
    findForbiddenEventPaths(child, childPath, found);
  }
  return found;
}

function serializedEvent(value: unknown): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Platform event must be JSON serializable");
  }
  if (serialized === undefined) throw new Error("Platform event must be JSON serializable");
  return serialized;
}

export function parsePlatformEvent(value: unknown): PlatformEvent {
  const forbidden = findForbiddenEventPaths(value);
  if (forbidden.length > 0) {
    throw new Error(`Platform events cannot contain credentials or direct private identities: ${forbidden.join(", ")}`);
  }
  if (new TextEncoder().encode(serializedEvent(value)).byteLength > MAX_PLATFORM_EVENT_BYTES) {
    throw new Error(`Platform event exceeds ${MAX_PLATFORM_EVENT_BYTES} bytes`);
  }
  return PlatformEventSchema.parse(value);
}
