import { z } from "zod";

export const TRANSPORT_COMMAND_CONTRACT = "platform.transport-command" as const;
export const TRANSPORT_RECEIPT_CONTRACT = "platform.transport-receipt" as const;
export const TRANSPORT_CONTRACT_VERSION = 1 as const;
export const MAX_TRANSPORT_COMMAND_BYTES = 64_000;

const Identifier = z.string().trim().min(1).max(200);
const ProjectId = z.string().trim().min(1).max(160);
const HttpUrl = z.string().url().max(3_000).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Expected an HTTP(S) URL");

export const TransportRouteSchema = z.enum([
  "activity",
  "activity_release",
  "activity_summary",
  "feedback",
  "incidents",
  "engagement",
  "feature_delivery",
  "operations",
]);

const BaseCommand = z.object({
  contract: z.literal(TRANSPORT_COMMAND_CONTRACT),
  version: z.literal(TRANSPORT_CONTRACT_VERSION),
  commandId: Identifier,
  idempotencyKey: Identifier,
  causedByEventId: z.string().uuid().optional(),
  correlationId: Identifier.optional(),
  orgId: z.number().int().positive(),
  projectId: ProjectId,
  route: TransportRouteSchema,
  routeContext: z.object({
    kind: z.enum(["source", "site"]),
    id: Identifier,
  }).strict().optional(),
  requestedAt: z.string().datetime({ offset: true }),
}).strict();

const SlackMessage = z.object({
  text: z.string().trim().min(1).max(4_000),
  client_msg_id: Identifier.optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
}).strict();

const SlackSend = BaseCommand.extend({
  operation: z.literal("slack.message.send"),
  input: z.object({ message: SlackMessage }).strict(),
}).strict();

const SlackUpdate = BaseCommand.extend({
  operation: z.literal("slack.message.update"),
  input: z.object({ messageId: Identifier, message: SlackMessage }).strict(),
}).strict();

const GitHubLabel = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(100).optional(),
}).strict();

const GitHubIssueFields = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(60_000),
  labels: z.array(GitHubLabel).max(20).default([]),
  assignees: z.array(z.string().regex(/^[A-Za-z0-9-]{1,39}$/)).max(20).optional(),
}).strict();

const GitHubIssueCreate = BaseCommand.extend({
  operation: z.literal("github.issue.create"),
  input: z.object({
    issue: GitHubIssueFields,
    idempotencyMarker: z.string().trim().min(8).max(300).optional(),
  }).strict(),
}).strict();

const GitHubIssueUpdate = BaseCommand.extend({
  operation: z.literal("github.issue.update"),
  input: z.object({
    issueNumber: z.number().int().positive(),
    issue: GitHubIssueFields.partial().extend({ state: z.enum(["open", "closed"]).optional() })
      .refine((value) => Object.keys(value).length > 0, "At least one issue field is required"),
  }).strict(),
}).strict();

const GitHubIssueComment = BaseCommand.extend({
  operation: z.literal("github.issue.comment"),
  input: z.object({
    issueNumber: z.number().int().positive(),
    body: z.string().trim().min(1).max(60_000),
  }).strict(),
}).strict();

const GitHubPullRequestClose = BaseCommand.extend({
  operation: z.literal("github.pull_request.close"),
  input: z.object({ pullRequestNumber: z.number().int().positive() }).strict(),
}).strict();

export const TransportCommandSchema = z.discriminatedUnion("operation", [
  SlackSend,
  SlackUpdate,
  GitHubIssueCreate,
  GitHubIssueUpdate,
  GitHubIssueComment,
  GitHubPullRequestClose,
]);

export type TransportCommand = z.infer<typeof TransportCommandSchema>;
export type TransportOperation = TransportCommand["operation"];
export type TransportProvider = "slack" | "github";

const ReceiptBase = z.object({
  contract: z.literal(TRANSPORT_RECEIPT_CONTRACT),
  version: z.literal(TRANSPORT_CONTRACT_VERSION),
  commandId: Identifier,
  idempotencyKey: Identifier,
  operation: z.enum([
    "slack.message.send",
    "slack.message.update",
    "github.issue.create",
    "github.issue.update",
    "github.issue.comment",
    "github.pull_request.close",
  ]),
  status: z.enum(["queued", "processing", "delivered", "blocked", "failed"]),
  attempts: z.number().int().nonnegative(),
  recordedAt: z.string().datetime({ offset: true }),
  error: z.object({
    code: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(1_000),
    retryable: z.boolean(),
  }).strict().optional(),
}).strict();

export const TransportReceiptSchema = z.discriminatedUnion("provider", [
  ReceiptBase.extend({
    provider: z.literal("slack"),
    result: z.object({
      channelId: Identifier,
      messageId: Identifier,
    }).strict().optional(),
  }).strict(),
  ReceiptBase.extend({
    provider: z.literal("github"),
    result: z.object({
      resourceType: z.enum(["issue", "pull_request", "comment"]),
      resourceId: Identifier,
      url: HttpUrl.optional(),
      state: z.string().trim().min(1).max(40).optional(),
    }).strict().optional(),
  }).strict(),
]).superRefine((receipt, context) => {
  if (receipt.status === "delivered" && !receipt.result) {
    context.addIssue({ code: "custom", path: ["result"], message: "Delivered receipts require a provider result" });
  }
  if ((receipt.status === "blocked" || receipt.status === "failed") && !receipt.error) {
    context.addIssue({ code: "custom", path: ["error"], message: `${receipt.status} receipts require an error` });
  }
});

export type TransportReceipt = z.infer<typeof TransportReceiptSchema>;

const FORBIDDEN_CREDENTIAL_KEYS = new Set([
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
]);
const PRODUCER_RESOLVED_DESTINATION_KEYS = new Set([
  "channelid",
  "connectionid",
  "installationid",
  "repository",
]);

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findForbiddenPaths(
  value: unknown,
  forbiddenKeys: ReadonlySet<string>,
  path = "$",
  found: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPaths(item, forbiddenKeys, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(normalizedKey(key))) found.push(childPath);
    findForbiddenPaths(child, forbiddenKeys, childPath, found);
  }
  return found;
}

const FORBIDDEN_COMMAND_KEYS = new Set([
  ...FORBIDDEN_CREDENTIAL_KEYS,
  ...PRODUCER_RESOLVED_DESTINATION_KEYS,
]);

export function findForbiddenTransportPaths(value: unknown): string[] {
  return findForbiddenPaths(value, FORBIDDEN_COMMAND_KEYS);
}

function assertBoundary(value: unknown, label: string, forbiddenKeys: ReadonlySet<string>): void {
  const forbidden = findForbiddenPaths(value, forbiddenKeys);
  if (forbidden.length > 0) {
    throw new Error(`${label} cannot contain credentials or resolved provider destinations: ${forbidden.join(", ")}`);
  }
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error(`${label} must be JSON serializable`); }
  if (serialized === undefined) throw new Error(`${label} must be JSON serializable`);
  if (new TextEncoder().encode(serialized).byteLength > MAX_TRANSPORT_COMMAND_BYTES) {
    throw new Error(`${label} exceeds ${MAX_TRANSPORT_COMMAND_BYTES} bytes`);
  }
}

export function parseTransportCommand(value: unknown): TransportCommand {
  assertBoundary(value, "Transport command", FORBIDDEN_COMMAND_KEYS);
  return TransportCommandSchema.parse(value);
}

export function parseTransportReceipt(value: unknown): TransportReceipt {
  assertBoundary(value, "Transport receipt", FORBIDDEN_CREDENTIAL_KEYS);
  return TransportReceiptSchema.parse(value);
}

export function providerForOperation(operation: TransportOperation): TransportProvider {
  return operation.startsWith("slack.") ? "slack" : "github";
}
