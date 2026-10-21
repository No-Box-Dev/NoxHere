import { readFile, writeFile } from "node:fs/promises";
import {
  LEGACY_NATIVE_EXCHANGE_CLIENTS,
  NATIVE_DEVICE_CLIENTS,
} from "../packages/contracts/native-clients.ts";

const target = new URL("../public/openapi.json", import.meta.url);
const original = await readFile(target, "utf8");
const document = JSON.parse(original);

// The first API inventory documented existing UI routes in place. Promote all
// first-party operations into the canonical v1 namespace while leaving the
// old handlers deployed as compatibility adapters. Feedback's anonymous
// capture API stays on its separately isolated public origin.
for (const [path, pathItem] of Object.entries(document.paths)) {
  const canonicalPath = canonicalApiPath(path);
  if (canonicalPath === path) continue;
  if (document.paths[canonicalPath]) {
    throw new Error(`Cannot promote ${path}: ${canonicalPath} already exists`);
  }
  document.paths[canonicalPath] = pathItem;
  delete document.paths[path];
}

// Growth, Usage, and Issues are independent public capabilities. Their first
// implementation reuses the mature telemetry handlers internally, but the
// canonical contract must not make clients depend on that implementation
// detail. Keep the old telemetry paths documented as compatibility routes.
const splitCapabilityPaths = [
  ["/api/v1/growth/events", "/api/v1/telemetry/public/events", { post: ["ingestGrowthEvent", "Ingest a Growth event", "Growth"] }],
  ["/api/v1/usage/events", "/api/v1/telemetry/public/events", { post: ["ingestUsageEvent", "Ingest a Usage event", "Usage"] }],
  ["/api/v1/growth/sources", "/api/v1/telemetry/sources", { get: ["listGrowthSources", "List Growth sources", "Growth"], post: ["createGrowthSource", "Create a Growth source", "Growth"] }],
  ["/api/v1/growth/sources/{sourceId}", "/api/v1/telemetry/sources/{sourceId}", { put: ["updateGrowthSource", "Update a Growth source", "Growth"], delete: ["deleteGrowthSource", "Delete a Growth source", "Growth"] }],
  ["/api/v1/growth/sources/{sourceId}/keys", "/api/v1/telemetry/sources/{sourceId}/keys", { get: ["listGrowthKeys", "List Growth ingest keys", "Growth"], post: ["createGrowthKey", "Create a Growth ingest key", "Growth"] }],
  ["/api/v1/growth/sources/{sourceId}/keys/{keyId}", "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}", { delete: ["revokeGrowthKey", "Revoke a Growth ingest key", "Growth"] }],
  ["/api/v1/growth/sources/{sourceId}/keys/{keyId}/rotate", "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}/rotate", { post: ["rotateGrowthKey", "Rotate a Growth ingest key", "Growth"] }],
  ["/api/v1/usage/sources", "/api/v1/telemetry/sources", { get: ["listUsageSources", "List Usage sources", "Usage"], post: ["createUsageSource", "Create a Usage source", "Usage"] }],
  ["/api/v1/usage/sources/{sourceId}", "/api/v1/telemetry/sources/{sourceId}", { put: ["updateUsageSource", "Update a Usage source", "Usage"], delete: ["deleteUsageSource", "Delete a Usage source", "Usage"] }],
  ["/api/v1/usage/sources/{sourceId}/keys", "/api/v1/telemetry/sources/{sourceId}/keys", { get: ["listUsageKeys", "List Usage ingest keys", "Usage"], post: ["createUsageKey", "Create a Usage ingest key", "Usage"] }],
  ["/api/v1/usage/sources/{sourceId}/keys/{keyId}", "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}", { delete: ["revokeUsageKey", "Revoke a Usage ingest key", "Usage"] }],
  ["/api/v1/usage/sources/{sourceId}/keys/{keyId}/rotate", "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}/rotate", { post: ["rotateUsageKey", "Rotate a Usage ingest key", "Usage"] }],
  ["/api/v1/usage/sources/{sourceId}/cards", "/api/v1/telemetry/sources/{sourceId}/cards", { get: ["listUsageCards", "List Usage metric cards", "Usage"], put: ["updateUsageCards", "Update Usage metric cards", "Usage"] }],
  ["/api/v1/projects/{projectId}/usage/dashboard", "/api/v1/projects/{projectId}/telemetry/dashboard", { get: ["getUsageProjectDashboard", "Read the project Usage dashboard", "Usage"] }],
  ["/api/v1/projects/{projectId}/usage/actions", "/api/v1/projects/{projectId}/telemetry/actions", { get: ["getUsageProjectActions", "Read project Usage actions", "Usage"], put: ["updateUsageProjectActions", "Update project Usage actions", "Usage"] }],
  ["/api/v1/projects/{projectId}/usage/events", "/api/v1/projects/{projectId}/telemetry/stat-events", { get: ["getUsageProjectEvents", "Read project Usage events", "Usage"] }],
  ["/api/v1/projects/{projectId}/issues/alerts", "/api/v1/projects/{projectId}/telemetry/alerts", { get: ["getProjectIssueIncidents", "Read project incidents", "Issues"] }],
  ["/api/v1/projects/{projectId}/issues/alert-rules", "/api/v1/projects/{projectId}/telemetry/alert-rules", { get: ["getProjectIssueAlertRules", "Read project alert rules", "Issues"] }],
];
for (const [targetPath, sourcePath, methods] of splitCapabilityPaths) {
  const source = document.paths[sourcePath];
  if (!source) throw new Error(`Cannot define ${targetPath}: ${sourcePath} is missing`);
  const target = {};
  for (const [method, [operationId, summary, tag]] of Object.entries(methods)) {
    const operation = structuredClone(source[method]);
    if (!operation) throw new Error(`Cannot define ${method.toUpperCase()} ${targetPath}: source operation is missing`);
    operation.operationId = operationId;
    operation.summary = summary;
    operation.description = `${summary}. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.`;
    operation.tags = [tag];
    target[method] = operation;
  }
  document.paths[targetPath] = target;
}

document.components.schemas.GrowthEventInput = structuredClone(document.components.schemas.TelemetryTrackedEvent);
document.components.schemas.GrowthEventInput.description = "Acquisition or subscription event accepted by Growth.";
document.components.schemas.GrowthEventInput.properties.name.pattern = "^(website|subscription)\\.[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*){0,4}$";
document.components.schemas.UsageTrackedEvent = structuredClone(document.components.schemas.TelemetryTrackedEvent);
document.components.schemas.UsageTrackedEvent.description = "Custom product-engagement event accepted by Usage.";
document.components.schemas.UsageTrackedEvent.properties.name.pattern = "^custom\\.[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*){0,4}$";
document.components.schemas.UsageEventInput = {
  description: "User lifecycle or product-engagement event accepted by Usage.",
  oneOf: [
    { "$ref": "#/components/schemas/TelemetryUserEvent" },
    { "$ref": "#/components/schemas/TelemetryActivityEvent" },
    { "$ref": "#/components/schemas/UsageTrackedEvent" },
  ],
};
const growthIngestBody = document.paths["/api/v1/growth/events"].post.requestBody.content["application/json"];
growthIngestBody.schema = { "$ref": "#/components/schemas/GrowthEventInput" };
growthIngestBody.examples = {
  signupIntent: {
    summary: "Anonymous signup intent",
    value: { version: 1, type: "activity.tracked", eventId: "8f7ec5e2-e8d3-4e08-a185-7fd4966e9529", occurredAt: "2026-10-09T08:00:00.000Z", environment: "production", name: "website.signup_clicked", value: 1 },
  },
  paidConversion: {
    summary: "Paid subscription conversion",
    value: { version: 1, type: "activity.tracked", eventId: "21f7b6ad-3648-4515-b086-b7a2a69de1bf", occurredAt: "2026-10-09T08:00:00.000Z", environment: "production", name: "subscription.paid_started", userId: "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40", value: 1 },
  },
};
const usageIngestBody = document.paths["/api/v1/usage/events"].post.requestBody.content["application/json"];
usageIngestBody.schema = { "$ref": "#/components/schemas/UsageEventInput" };
usageIngestBody.examples = {
  activeUser: {
    summary: "Daily active user",
    value: { version: 1, type: "user.active", occurredAt: "2026-10-09T08:00:00.000Z", environment: "production", userId: "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40" },
  },
  engagementAction: {
    summary: "Custom product action",
    value: { version: 1, type: "activity.tracked", eventId: "21f7b6ad-3648-4515-b086-b7a2a69de1bf", occurredAt: "2026-10-09T08:00:00.000Z", environment: "production", name: "custom.comments.written", userId: "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40", value: 1 },
  },
};

const growthDashboardOperation = structuredClone(document.paths["/api/v1/projects/{projectId}/telemetry/dashboard"].get);
growthDashboardOperation.operationId = "getGrowthProjectDashboard";
growthDashboardOperation.summary = "Read the project Growth dashboard";
growthDashboardOperation.description = "Read the project Growth dashboard. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.";
growthDashboardOperation.tags = ["Growth"];
growthDashboardOperation.responses["200"].content["application/json"].schema = { "$ref": "#/components/schemas/GrowthDashboard" };
document.paths["/api/v1/projects/{projectId}/growth/dashboard"] = { get: growthDashboardOperation };

const growthEventsOperation = structuredClone(document.paths["/api/v1/projects/{projectId}/telemetry/stat-events"].get);
growthEventsOperation.operationId = "getGrowthProjectEvents";
growthEventsOperation.summary = "Read project Growth events";
growthEventsOperation.description = "Read project Growth events. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.";
growthEventsOperation.tags = ["Growth"];
growthEventsOperation.responses["200"].content["application/json"].schema = { "$ref": "#/components/schemas/GrowthEventList" };
document.paths["/api/v1/projects/{projectId}/growth/events"] = { get: growthEventsOperation };

document.info.title = "NoxHere API";
document.info.description = "One API for NoxHere workspace, planning, activity, feedback, growth, product usage, and operational issues.";
document.servers = [{ url: "https://app.noxhere.com", description: "Hosted NoxHere API" }];
document.tags = [
  { name: "NoxHere", description: "Workspace connections, identity, repositories, projects, and shared delivery." },
  { name: "Planning", description: "Features, workflow, specifications, and attachments." },
  { name: "Activity", description: "Current work, engineering activity, and narratives." },
  { name: "Feedback", description: "Sites, website feedback capture, and screenshots." },
  { name: "Growth", description: "Acquisition, signup intent, trials, paid conversion, cancellation, and growth-event sources." },
  { name: "Usage", description: "Users, product adoption, engagement actions, and usage-event sources." },
  { name: "Issues", description: "Repository issues, runtime incidents, alert rules, and incident routing." },
  { name: "Stats", description: "Legacy compatibility routes superseded by Growth and Usage." },
  { name: "Incidents", description: "Legacy compatibility routes superseded by Issues." },
];
document.components.schemas.JsonValue = {
  description: "Legacy response whose stable typed schema has not yet been promoted into API v1.",
  oneOf: [
    { type: "null" },
    { type: "boolean" },
    { type: "number" },
    { type: "string" },
    { type: "array", items: { "$ref": "#/components/schemas/JsonValue" } },
    { type: "object", additionalProperties: { "$ref": "#/components/schemas/JsonValue" } },
  ],
};
document.components.schemas.ApiRecord = {
  type: "object",
  additionalProperties: true,
};
document.components.schemas.MutationReceipt = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    status: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
};
document.components.schemas.ActivityActor = {
  type: "object",
  additionalProperties: false,
  required: ["login", "name", "avatarUrl"],
  properties: {
    login: { type: "string" },
    name: { type: ["string", "null"] },
    avatarUrl: { type: ["string", "null"], format: "uri" },
  },
};
document.components.schemas.ActivityPullRequest = {
  type: "object",
  additionalProperties: false,
  required: ["number", "title", "url"],
  properties: {
    number: { type: "integer" },
    title: { type: "string" },
    url: { type: "string", format: "uri" },
  },
};
document.components.schemas.ActivityEvent = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "createdAt", "actor", "repo", "summary", "technicalSummary", "pr"],
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["opened", "merged", "release-notes"] },
    createdAt: { type: "string", format: "date-time" },
    actor: { "$ref": "#/components/schemas/ActivityActor" },
    repo: { type: "string" },
    summary: { type: "string" },
    technicalSummary: { type: "string" },
    pr: { oneOf: [{ "$ref": "#/components/schemas/ActivityPullRequest" }, { type: "null" }] },
  },
};
document.components.schemas.ActivityPage = {
  type: "object",
  additionalProperties: false,
  required: ["events", "nextCursor"],
  properties: {
    events: { type: "array", items: { "$ref": "#/components/schemas/ActivityEvent" } },
    nextCursor: { type: ["string", "null"] },
  },
};
document.components.schemas.PaginatedRecords = {
  type: "object",
  additionalProperties: true,
  required: ["data", "totalCount", "page", "pageSize"],
  properties: {
    data: { type: "array", items: { "$ref": "#/components/schemas/ApiRecord" } },
    totalCount: { type: "integer", minimum: 0 },
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1 },
  },
};
document.components.schemas.RecordCollection = {
  oneOf: [
    { type: "array", items: { "$ref": "#/components/schemas/ApiRecord" } },
    { "$ref": "#/components/schemas/PaginatedRecords" },
    { "$ref": "#/components/schemas/ApiRecord" },
  ],
};
document.components.schemas.Feature = {
  allOf: [{ "$ref": "#/components/schemas/ApiRecord" }],
  description: "Planning feature mirrored from its GitHub issue, including number, title, workflow status, owners, labels, and project.",
};
document.components.schemas.FeatureList = {
  type: "array",
  items: { "$ref": "#/components/schemas/Feature" },
};
document.components.schemas.Spec = {
  allOf: [{ "$ref": "#/components/schemas/ApiRecord" }],
  description: "Planning specification with its project, workflow state, content, and archive metadata.",
};
document.components.schemas.SpecList = {
  type: "object",
  additionalProperties: false,
  required: ["specs"],
  properties: { specs: { type: "array", items: { "$ref": "#/components/schemas/Spec" } } },
};
document.components.schemas.SpecAttachment = {
  allOf: [{ "$ref": "#/components/schemas/ApiRecord" }],
  description: "Metadata for one specification attachment.",
};
document.components.schemas.SpecAttachmentList = {
  type: "object",
  additionalProperties: false,
  required: ["attachments"],
  properties: { attachments: { type: "array", items: { "$ref": "#/components/schemas/SpecAttachment" } } },
};
document.components.schemas.FeedbackErrorBatch = {
  type: "object",
  additionalProperties: false,
  required: ["siteId", "errors"],
  properties: {
    siteId: { type: "string", minLength: 1 },
    errors: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: true,
        required: ["message"],
        properties: {
          message: { type: "string", minLength: 1, maxLength: 2000 },
          title: { type: "string", maxLength: 200 },
          url: { type: "string", format: "uri", maxLength: 2048 },
        },
      },
    },
  },
};
document.components.schemas.TelemetryIngestResponse = {
  type: "object",
  required: ["accepted", "stored", "eventId", "queued"],
  properties: {
    accepted: { const: true },
    stored: { type: "boolean" },
    eventId: { type: "string" },
    queued: { type: "boolean" },
    duplicate: { type: "boolean" },
    notificationSuppressed: { type: "boolean" },
    period: { type: "string" },
  },
};
document.components.schemas.TelemetryGitHubIssueSettingsUpdate = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "enabled", "environments"],
  properties: {
    projectId: { type: "string", minLength: 1, maxLength: 200 },
    enabled: { type: "boolean" },
    environments: {
      type: "array", minItems: 1, maxItems: 6, uniqueItems: true,
      items: { type: "string", enum: ["production", "staging", "development", "preview", "test", "local"] },
    },
    commentOnRepeat: { type: "boolean", default: false },
    repeatIntervalMinutes: { type: "integer", minimum: 15, maximum: 10080, default: 360 },
  },
};
document.components.schemas.StatCard = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "value", "context", "change", "direction", "points"],
  description: "One formatted statistics card and its ordered chart points.",
  properties: {
    id: { type: "string", description: "Stable metric key." },
    name: { type: "string", description: "Human-readable card label." },
    value: { type: "string", description: "Formatted current value." },
    context: { type: "string", description: "Window or comparison context." },
    change: { type: "string", description: "Formatted change from the comparison period." },
    direction: { type: "string", enum: ["up", "down", "same"] },
    points: { type: "array", items: { type: "number" }, description: "Oldest-to-newest chart values." },
    breakdown: { "$ref": "#/components/schemas/StatCardBreakdown" },
  },
};
document.components.schemas.StatCardBreakdown = {
  type: "object", additionalProperties: false,
  required: ["actionLabel", "windowDays", "totalActions", "activeUsers", "participatingUsers", "participationRate", "actionsPerParticipant"],
  properties: {
    actionLabel: { type: "string" }, windowDays: { type: "integer", minimum: 1 },
    totalActions: { type: "integer", minimum: 0 }, activeUsers: { type: "integer", minimum: 0 },
    participatingUsers: { type: "integer", minimum: 0 }, participationRate: { type: "number", minimum: 0 },
    actionsPerParticipant: { type: "number", minimum: 0 },
  },
};
document.components.schemas.StatsDashboard = {
  type: "object", additionalProperties: false, required: ["range", "dateLabel", "reportStatus", "stats"],
  description: "Production statistics dashboard for one project.",
  properties: {
    range: { type: "string" }, dateLabel: { type: "string" }, reportStatus: { type: "string" },
    stats: { type: "array", items: { "$ref": "#/components/schemas/StatCard" } },
  },
};
document.components.schemas.GrowthMetric = {
  type: "object", additionalProperties: false, required: ["id", "label", "value", "points"],
  properties: {
    id: { type: "string" }, label: { type: "string" }, value: { type: "number" },
    points: { type: "array", items: { type: "number" } },
  },
};
document.components.schemas.GrowthFunnel = {
  type: "object", additionalProperties: false,
  required: ["visits", "signupIntents", "trials", "paid", "cancelled", "trialToPaidRate"],
  properties: {
    visits: { type: "number", minimum: 0 }, signupIntents: { type: "number", minimum: 0 },
    trials: { type: "number", minimum: 0 }, paid: { type: "number", minimum: 0 },
    cancelled: { type: "number", minimum: 0 }, trialToPaidRate: { type: ["number", "null"], minimum: 0 },
  },
};
document.components.schemas.GrowthAcquisitionRow = {
  type: "object", additionalProperties: false,
  required: ["label", "visitors", "trials", "paid", "revenueMinor", "currency"],
  properties: {
    label: { type: "string" }, visitors: { type: "integer", minimum: 0 },
    trials: { type: "integer", minimum: 0 }, paid: { type: "integer", minimum: 0 },
    revenueMinor: { type: "integer", minimum: 0 }, currency: { type: ["string", "null"] },
  },
};
document.components.schemas.GrowthAcquisition = {
  type: "object", additionalProperties: false,
  required: ["channels", "campaigns", "landingPages"],
  properties: {
    channels: { type: "array", items: { "$ref": "#/components/schemas/GrowthAcquisitionRow" } },
    campaigns: { type: "array", items: { "$ref": "#/components/schemas/GrowthAcquisitionRow" } },
    landingPages: { type: "array", items: { "$ref": "#/components/schemas/GrowthAcquisitionRow" } },
  },
};
document.components.schemas.GrowthDashboard = {
  type: "object", additionalProperties: false,
  required: ["projectId", "range", "dateLabel", "metrics", "funnel", "revenue", "acquisition"],
  properties: {
    projectId: { type: "string" }, range: { type: "string", enum: ["all", "7d", "30d", "90d", "1y"] },
    dateLabel: { type: "string" },
    metrics: { type: "array", items: { "$ref": "#/components/schemas/GrowthMetric" } },
    funnel: { "$ref": "#/components/schemas/GrowthFunnel" },
    revenue: {
      type: "object", additionalProperties: false, required: ["amountMinor", "currency"],
      properties: { amountMinor: { type: "integer", minimum: 0 }, currency: { type: ["string", "null"] } },
    },
    acquisition: { "$ref": "#/components/schemas/GrowthAcquisition" },
  },
};
document.components.schemas.GrowthEvent = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "value", "subject", "environment", "occurredAt"],
  properties: {
    id: { type: "string" }, name: { type: "string" }, value: { type: "number" },
    subject: { type: ["string", "null"] }, environment: { type: "string" },
    occurredAt: { type: "string", format: "date-time" },
  },
};
document.components.schemas.GrowthEventList = {
  type: "array", items: { "$ref": "#/components/schemas/GrowthEvent" },
};
document.components.schemas.TelemetryAction = {
  type: "object", additionalProperties: false, required: ["slot", "key", "label"],
  properties: {
    slot: { type: "integer", minimum: 1, maximum: 3 },
    key: { type: "string", pattern: "^custom\\.[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*){0,4}$" },
    label: { type: "string", minLength: 1, maxLength: 80 },
  },
};
document.components.schemas.TelemetryActions = {
  type: "object", additionalProperties: false, required: ["projectId", "windowDays", "actions", "snippet"],
  properties: {
    projectId: { type: "string" }, windowDays: { type: "integer", enum: [7, 14, 30] },
    actions: { type: "array", maxItems: 3, items: { "$ref": "#/components/schemas/TelemetryAction" } },
    snippet: { type: "string" },
  },
};
document.components.schemas.StatEvent = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "type", "subject", "environment", "receivedAt", "status"],
  properties: {
    id: { type: "string" }, name: { type: "string" }, type: { type: "string" },
    subject: { type: "string", description: "Truncated protected subject hash; never the original identifier." },
    environment: { type: "string" }, receivedAt: { type: "string", format: "date-time" },
    status: { type: "string", enum: ["accepted", "rejected"] },
  },
};
document.components.schemas.StatEventList = { type: "array", items: { "$ref": "#/components/schemas/StatEvent" } };
document.components.schemas.IncidentAlert = {
  type: "object", additionalProperties: false,
  required: ["id", "sourceId", "fingerprint", "title", "environment", "summary", "status", "occurrences", "happenedAt"],
  properties: {
    id: { type: "string" }, sourceId: { type: "string" }, fingerprint: { type: "string" },
    title: { type: "string" }, environment: { type: "string" }, summary: { type: "string" },
    status: { type: "string", enum: ["active", "resolved"] }, occurrences: { type: "integer", minimum: 1 },
    happenedAt: { type: "string", format: "date-time" },
  },
};
document.components.schemas.IncidentAlertList = { type: "array", items: { "$ref": "#/components/schemas/IncidentAlert" } };
document.components.schemas.IncidentAlertRule = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "kind", "condition", "environment", "source", "enabled"],
  properties: {
    id: { type: "string" }, name: { type: "string" }, kind: { type: "string", enum: ["feature", "error", "health"] },
    condition: { type: "string" }, environment: { type: "string" }, source: { type: "string" }, enabled: { type: "boolean" },
  },
};
document.components.schemas.IncidentAlertRuleList = { type: "array", items: { "$ref": "#/components/schemas/IncidentAlertRule" } };
document.components.schemas.ProjectIncident = {
  type: "object", additionalProperties: false,
  required: ["id", "sourceId", "fingerprint", "title", "errorCode", "component", "environment", "firstSeenAt", "lastSeenAt", "occurrenceCount", "status", "acknowledgedAt", "acknowledgedBy", "resolvedAt", "resolvedBy"],
  properties: {
    id: { type: "string", pattern: "^inc_[a-f0-9]{32}$" }, sourceId: { type: "string" }, sourceName: { type: "string" },
    fingerprint: { type: "string" }, title: { type: "string" }, errorCode: { type: ["string", "null"] },
    component: { type: ["string", "null"] }, environment: { type: ["string", "null"] },
    firstSeenAt: { type: "string", format: "date-time" }, lastSeenAt: { type: "string", format: "date-time" },
    occurrenceCount: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["open", "acknowledged", "resolved"] },
    acknowledgedAt: { type: ["string", "null"], format: "date-time" }, acknowledgedBy: { type: ["string", "null"] },
    resolvedAt: { type: ["string", "null"], format: "date-time" }, resolvedBy: { type: ["string", "null"] },
    updatedAt: { type: "string", format: "date-time" },
  },
};
document.components.schemas.ProjectIncidentResponse = {
  type: "object", additionalProperties: false, required: ["incident"],
  properties: { incident: { "$ref": "#/components/schemas/ProjectIncident" } },
};
document.components.schemas.ProjectIncidentUpdate = {
  type: "object", additionalProperties: false, required: ["status"],
  properties: { status: { type: "string", enum: ["open", "acknowledged", "resolved"] } },
};
document.components.schemas.ProjectIncidentOverview = {
  type: "object", additionalProperties: false, required: ["project", "sources", "metrics", "errors"],
  description: "Incident overview for the selected project, including active sources and unresolved error groups.",
  properties: {
    project: { oneOf: [
      { type: "object", additionalProperties: false, required: ["id", "name"], properties: { id: { type: "string" }, name: { type: "string" } } },
      { type: "null" },
    ] },
    sources: { type: "array", items: { type: "object", additionalProperties: true, required: ["id", "name", "environment"], properties: {
      id: { type: "string" }, name: { type: "string" }, environment: { type: "string" },
      last_registration_at: { type: ["string", "null"], format: "date-time" }, last_activity_at: { type: ["string", "null"], format: "date-time" },
    } } },
    metrics: { type: "array", items: { type: "object", additionalProperties: true, required: ["source_id", "source_name", "period", "metric_key", "value", "origin"], properties: {
      source_id: { type: "string" }, source_name: { type: "string" }, period: { type: "string", format: "date" },
      metric_key: { type: "string" }, value: { type: "number" }, origin: { type: "string" },
    } } },
    errors: { type: "array", items: { type: "object", additionalProperties: true, required: ["id", "source_id", "source_name", "fingerprint", "title", "environment", "last_seen_at", "occurrence_count"], properties: {
      id: { type: "string" }, source_id: { type: "string" }, source_name: { type: "string" }, fingerprint: { type: "string" },
      title: { type: "string" }, environment: { type: "string" }, last_seen_at: { type: "string", format: "date-time" },
      occurrence_count: { type: "integer", minimum: 1 },
    } } },
  },
};
document.components.schemas.ApiTokenCreate = {
  type: "object",
  additionalProperties: false,
  required: ["name", "projectId", "scopes"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    environment: { type: "string", enum: ["production", "staging", "test"], default: "production" },
    projectId: { type: "string", minLength: 1, maxLength: 240, description: "One enabled NoxHere project. The token cannot access resources assigned to another project." },
    scopes: { type: "array", minItems: 1, maxItems: 16, uniqueItems: true, items: { type: "string", pattern: "^(services:read|developer-feedback:write|slack:(send|read|write)|planning:(read|write)|activity:(read|write)|feedback:(submit|read|write)|growth:(ingest|read|write)|usage:(ingest|read|write)|issues:(read|write)|telemetry:(ingest|read|write))$" } },
    expiresInDays: { type: "integer", minimum: 1, maximum: 365, default: 90 },
  },
};
document.components.schemas.DeveloperFeedbackCreate = {
  type: "object",
  additionalProperties: false,
  required: ["area", "category", "summary", "details", "idempotencyKey"],
  properties: {
    area: { type: "string", enum: ["api", "documentation", "sdk", "product", "other"] },
    category: { type: "string", enum: ["bug", "friction", "suggestion", "missing_capability", "other"] },
    summary: { type: "string", minLength: 1, maxLength: 240 },
    details: { type: "string", minLength: 1, maxLength: 4000 },
    suggestedChange: { type: "string", minLength: 1, maxLength: 2000 },
    operationId: { type: "string", minLength: 1, maxLength: 160 },
    impact: { type: "string", enum: ["low", "medium", "high"] },
    idempotencyKey: {
      type: "string", minLength: 8, maxLength: 160, pattern: "^[A-Za-z0-9._:-]{8,160}$",
      description: "Stable per observation. Reusing it from the same credential returns the original receipt.",
    },
    client: {
      type: "object", additionalProperties: false, required: ["name"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        version: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
  },
};
document.components.schemas.DeveloperFeedbackReceipt = {
  type: "object",
  additionalProperties: false,
  required: ["apiVersion", "feedback"],
  properties: {
    apiVersion: { type: "integer", enum: [1] },
    feedback: {
      type: "object", additionalProperties: false,
      required: ["id", "status", "duplicate", "createdAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["received"] },
        duplicate: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
};
document.components.schemas.FeedbackResolutionTemplate = {
  type: "object",
  additionalProperties: false,
  required: ["tone", "senderName", "subject", "acknowledgement", "reopenText", "buttonLabel", "closing", "replyTo", "appearance"],
  properties: {
    tone: { type: "string", enum: ["default", "warm", "formal", "concise"] },
    senderName: { type: "string", minLength: 1, maxLength: 80, description: "Display name shown next to the platform's verified sending address." },
    subject: { type: "string", minLength: 1, maxLength: 200 },
    acknowledgement: { type: "string", minLength: 1, maxLength: 500 },
    reopenText: { type: "string", minLength: 1, maxLength: 500 },
    buttonLabel: { type: "string", minLength: 1, maxLength: 60 },
    closing: { type: "string", minLength: 1, maxLength: 500 },
    replyTo: { type: ["string", "null"], format: "email", maxLength: 254 },
    appearance: {
      type: "object",
      additionalProperties: false,
      required: ["accentColor", "backgroundColor", "surfaceColor", "textColor", "mutedColor", "fontPreset"],
      properties: {
        accentColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        backgroundColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        surfaceColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        textColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        mutedColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        fontPreset: { type: "string", enum: ["system", "playnist", "humanist", "editorial", "mono"], description: "Email-safe font stack. Custom fonts fall back safely when the recipient's client does not support them." },
      },
    },
  },
  description: "Site-level content and brand presentation for Feedback resolution emails. Every site can configure this in NoxHere or with a project-scoped API token. Only {{report_title}} and {{site_name}} placeholders are accepted. NoxHere owns the evidence rules, AI safety prompt, safe HTML rendering, verified sender address, and reopen behavior.",
};
document.components.schemas.FeedbackResolutionTemplateDocument = {
  type: "object",
  additionalProperties: false,
  required: ["template", "defaults", "usingDefault", "revision"],
  properties: {
    template: { "$ref": "#/components/schemas/FeedbackResolutionTemplate" },
    defaults: { "$ref": "#/components/schemas/FeedbackResolutionTemplate" },
    usingDefault: { type: "boolean" },
    revision: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
};

const resolutionTemplatePath = "/api/v1/feedback/sites/{siteId}/resolution-template";
const resolutionTemplateParameters = [{ name: "siteId", in: "path", required: true, schema: { type: "string", minLength: 1 } }];
document.paths[resolutionTemplatePath] = {
  get: {
    operationId: "getFeedbackResolutionTemplate",
    summary: "Read the effective Feedback resolution email template",
    description: "Returns the site's custom content and appearance or the NoxHere default plus a revision for conditional updates. Organization admins and project-scoped API tokens can use the same endpoint.",
    parameters: resolutionTemplateParameters,
    responses: { "200": { description: "Effective template", content: { "application/json": { schema: { "$ref": "#/components/schemas/FeedbackResolutionTemplateDocument" } } } } },
    "x-required-role": "admin",
  },
  patch: {
    operationId: "updateFeedbackResolutionTemplate",
    summary: "Update or reset a Feedback resolution email template",
    description: "Send the revision returned by GET as If-Match. Set template to null to restore the default. This is the self-service configuration used by the NoxHere UI and is also available to project-scoped API tokens. Postmark is transport-only; NoxHere validates, renders, and snapshots the template used for each resolution.",
    parameters: [...resolutionTemplateParameters, { name: "If-Match", in: "header", required: true, schema: { type: "string" } }],
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["template"], properties: { template: { oneOf: [{ "$ref": "#/components/schemas/FeedbackResolutionTemplate" }, { type: "null" }] } } } } } },
    responses: {
      "200": { description: "Saved template", content: { "application/json": { schema: { "$ref": "#/components/schemas/FeedbackResolutionTemplateDocument" } } } },
      "412": { description: "The template changed since it was read" },
      "428": { description: "If-Match is required" },
    },
    "x-required-role": "admin",
  },
};
document.paths[`${resolutionTemplatePath}/preview`] = {
  post: {
    operationId: "previewFeedbackResolutionTemplate",
    summary: "Render a safe preview of a draft resolution email template",
    parameters: resolutionTemplateParameters,
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["template"], properties: { template: { "$ref": "#/components/schemas/FeedbackResolutionTemplate" } } } } } },
    responses: { "200": { description: "Rendered preview" } },
    "x-required-role": "admin",
  },
};
document.paths[`${resolutionTemplatePath}/test`] = {
  post: {
    operationId: "testFeedbackResolutionTemplate",
    summary: "Send a draft resolution email through NoxHere and Postmark",
    description: "The draft does not need to be saved. NoxHere renders the safe email and sends it through its private Postmark-backed email capability.",
    parameters: resolutionTemplateParameters,
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["recipient", "template"], properties: { recipient: { type: "string", format: "email", maxLength: 254 }, template: { "$ref": "#/components/schemas/FeedbackResolutionTemplate" } } } } } },
    responses: { "200": { description: "Postmark accepted the test email" }, "503": { description: "Email delivery is unavailable" } },
    "x-required-role": "admin",
  },
};

document.components.securitySchemes.browserSession = {
  type: "apiKey", in: "cookie", name: "__Host-nox_session",
  description: "Opaque HttpOnly session created by an email magic link or GitHub OAuth. Browser mutations also require X-CSRF-Token.",
};
document.components.securitySchemes.csrfProof = {
  type: "apiKey", in: "header", name: "X-CSRF-Token",
  description: "Required with the nox_csrf cookie for unsafe browser-session requests. Native sessions and automation tokens do not use CSRF proof.",
};
document.components.securitySchemes.noxApiToken = {
  type: "http", scheme: "bearer", bearerFormat: "nox_sk_{environment}_…",
  description: "Organization- and project-bound, service-scoped NoxHere automation token. Store as a secret; the value is shown only once.",
};
document.components.securitySchemes.nativeSession = {
  type: "http", scheme: "bearer", bearerFormat: "nox_at_…",
  description: "Short-lived first-party native application session issued by NoxHere. Refresh with a rotating nox_rt_ credential; provider credentials remain encrypted in NoxHere.",
};
document.components.parameters.projectContext = {
  name: "X-Project-ID",
  in: "header",
  required: false,
  description: "Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token.",
  schema: { type: "string", minLength: 1, maxLength: 240 },
};
document.components.parameters.telemetrySourceContext = {
  name: "X-Nox-Source-ID",
  in: "header",
  required: false,
  description: "Selects the destination source for a project-scoped NoxHere API token. It may be omitted when exactly one enabled source matches the token project and environment. Publishable source keys already identify their source.",
  schema: { type: "string", minLength: 1, maxLength: 240 },
};
delete document.components.securitySchemes.bearerAuth;
document.components.responses.Unauthorized.description = "Missing, invalid, or expired supported credential";
document.components.responses.RateLimited = {
  description: "Request rate limit exceeded. Wait for the Retry-After delay before retrying.",
  headers: {
    "Retry-After": {
      description: "Seconds to wait before another request.",
      schema: { type: "integer", minimum: 1 },
    },
  },
  content: { "application/json": { schema: { "$ref": "#/components/schemas/ApiV1Error" } } },
};
document.components.responses.PayloadTooLarge = {
  description: "Request payload exceeds the operation's documented size limit.",
  content: { "application/json": { schema: { "$ref": "#/components/schemas/ApiV1Error" } } },
};
document.security = [
  { browserSession: [], organization: [] },
  { nativeSession: [], organization: [] },
];

for (const pathItem of Object.values(document.paths)) {
  for (const operation of Object.values(pathItem)) {
    if (!operation || typeof operation !== "object" || !Array.isArray(operation.security)) continue;
    operation.security = operation.security.filter((requirement) => !("bearerAuth" in requirement));
  }
}

document.paths["/api/v1/auth/native/device/start"] = {
  post: nativeAuthOperation("startNativeDeviceAuthorization", "Start native GitHub authorization", {
    type: "object", additionalProperties: false, required: ["client"],
    properties: { client: { type: "string", enum: [...NATIVE_DEVICE_CLIENTS] } },
  }, "Returns an opaque NoxHere device handle plus the GitHub verification URI and user code."),
};
document.paths["/api/v1/auth/native/device/poll"] = {
  post: nativeAuthOperation("pollNativeDeviceAuthorization", "Poll native GitHub authorization", {
    type: "object", additionalProperties: false, required: ["client", "device_code"],
    properties: { client: { type: "string", enum: [...NATIVE_DEVICE_CLIENTS] }, device_code: { type: "string", pattern: "^noxid_" } },
  }, "NoxHere completes the GitHub exchange server-side and returns its own short-lived access and rotating refresh credentials."),
};
document.paths["/api/v1/auth/native/refresh"] = {
  post: nativeAuthOperation("refreshNativeSession", "Rotate a native session", {
    type: "object", additionalProperties: false, required: ["refresh_token"],
    properties: { refresh_token: { type: "string", pattern: "^nox_rt_", writeOnly: true } },
  }, "Rotates both native credentials. The previous access and refresh values stop working immediately."),
};
document.paths["/api/v1/auth/native/exchange"] = {
  post: nativeAuthOperation("exchangeLegacyNativeCredential", "Upgrade a legacy native session", {
    type: "object", additionalProperties: false, required: ["client", "access_token"],
    properties: {
      client: { type: "string", enum: [...LEGACY_NATIVE_EXCHANGE_CLIENTS] },
      access_token: { type: "string", writeOnly: true },
      refresh_token: { type: "string", writeOnly: true },
    },
  }, "Temporary one-time migration route for older Apple app releases. Normal sign-in uses the brokered device flow."),
};
document.paths["/api/v1/auth/native/revoke"] = {
  post: {
    operationId: "revokeNativeSession",
    summary: "Revoke the current native session",
    description: "Send the rotating refresh credential so sign-out can revoke the server session even after the short-lived access credential expires. A valid access bearer remains supported for older clients.",
    security: [],
    requestBody: {
      required: true,
      content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["refresh_token"],
        properties: { refresh_token: { type: "string", pattern: "^nox_rt_", writeOnly: true } },
      } } },
    },
    "x-native-refresh": true,
    responses: { "200": { description: "Session revoked" }, "401": { description: "Invalid or expired session" } },
  },
};

document.paths["/api/feedback/public/v1/sites/{siteId}/members"] = {
  get: {
    operationId: "getPublicFeedbackMembers",
    summary: "List public Feedback reporter choices for the request origin",
    description: "Returns at most 250 human GitHub organization members after validating the site and configured origin. Bots and internal membership metadata are not exposed.",
    security: [],
    servers: [{ url: "https://app.noxhere.com" }],
    parameters: [{ "$ref": "#/components/parameters/siteId" }],
    responses: {
      "200": {
        description: "Origin-scoped reporter choices",
        content: { "application/json": { schema: {
          type: "object",
          required: ["members"],
          properties: {
            members: {
              type: "array",
              maxItems: 250,
              items: {
                type: "object",
                required: ["login"],
                properties: {
                  login: { type: "string" },
                  avatarUrl: { type: ["string", "null"], format: "uri" },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        } } },
      },
      "403": { description: "Origin is not enabled", content: { "application/json": { schema: { "$ref": "#/components/schemas/LegacyError" } } } },
      "404": { description: "Site not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/LegacyError" } } } },
    },
  },
};

// First-party clients use the same versioned boundary as external consumers.
// These routes retain their established response payloads while gaining the
// v1 error, cache, discovery, authentication, and service-gating contract.
const clientRouteContracts = [
  ["/api/v1/auth/profile", [["get", "getIdentityProfile", "Read the signed-in GitHub identity and organizations", "member", false]]],
  ["/api/v1/auth/logout", [["post", "revokeBrowserSession", "Revoke the current browser session", "member", false]]],
  ["/api/v1/app-activity", [["post", "recordAppActivity", "Record bounded first-party app activity", "member"]]],
  ["/api/v1/assign", [["post", "assignIssue", "Assign a tracked GitHub issue", "member"]]],
  ["/api/v1/bootstrap-status", [["get", "getBootstrapStatus", "Read initial GitHub synchronization status", "member"]]],
  ["/api/v1/config/{key}", [
    ["get", "getWorkspaceConfig", "Read one shared workspace configuration document", "member"],
    ["put", "putWorkspaceConfig", "Replace one shared workspace configuration document", "admin"],
  ]],
  ["/api/v1/telemetry/project-overview", [["get", "getTelemetryProjectOverview", "Read a guest-safe Telemetry project overview", "member"]]],
  ["/api/v1/telemetry/sources/{sourceId}/health/test", [["post", "testTelemetrySource", "Test a Telemetry source destination", "admin"]]],
  ["/api/v1/engineer-stats", [["get", "getEngineerStats", "Read current work counts by engineer", "member"]]],
  ["/api/v1/events", [["get", "listActivityEvents", "List detailed Activity events", "member"]]],
  ["/api/v1/events/{id}", [["get", "getActivityEvent", "Read one detailed Activity event", "member"]]],
  ["/api/v1/github/comments", [["get", "getGitHubComments", "Read comments for a tracked pull request", "member"]]],
  ["/api/v1/github/details", [["get", "getGitHubDetails", "Read live details for a tracked issue or pull request", "member"]]],
  ["/api/v1/github/rate-limit", [["get", "getGitHubRateLimit", "Read the connected GitHub installation rate limit", "member"]]],
  ["/api/v1/guests", [["get", "listGuestAccess", "List guest invitations and active grants", "admin"]]],
  ["/api/v1/guests/invites", [["post", "createGuestInvitation", "Invite a guest to an organization, project, or capability", "admin"]]],
  ["/api/v1/guests/invites/{inviteId}", [["patch", "updateGuestInvitationScope", "Change a pending guest invitation scope", "admin"], ["delete", "revokeGuestInvitation", "Revoke a pending guest invitation", "admin"]]],
  ["/api/v1/guests/invites/{inviteId}/resend", [["post", "resendGuestInvitation", "Resend a pending guest invitation with a fresh expiry", "admin"]]],
  ["/api/v1/guests/grants/{grantId}", [["patch", "updateGuestGrantScope", "Change active guest access scope", "admin"], ["delete", "revokeGuestGrant", "Revoke active guest access", "admin"]]],
  ["/api/v1/memberships", [["get", "listOrganizationMemberships", "List organization members and effective roles", "member"]]],
  ["/api/v1/memberships/{principalId}", [["patch", "updateOrganizationMemberRole", "Assign an Admin, Member, or Viewer role", "admin"]]],
  ["/api/v1/audit-log", [["get", "listOrganizationAuditLog", "List recent access and administration changes", "admin"]]],
  ["/api/v1/integrations/status", [["get", "getIntegrationStatus", "Read credential-free integration readiness", "member"]]],
  ["/api/v1/issue-state", [["post", "setIssueState", "Open or close a tracked GitHub issue", "member"]]],
  ["/api/v1/me", [["get", "getCurrentMember", "Read membership and NoxHere role for the current organization", "member"]]],
  ["/api/v1/members", [["get", "listMembers", "List members visible through the connected GitHub organization", "member"]]],
  ["/api/v1/activity/release-notes-prompt", [["get", "getActivityDefaultPrompt", "Read the server-owned Activity release-notes prompt", "admin"]]],
  ["/api/v1/op-failures", [
    ["get", "listOperationFailures", "List recent background-operation failures and quarantined tasks", "admin"],
    ["post", "requeueQuarantinedTask", "Requeue one quarantined background task", "admin"],
  ]],
  ["/api/v1/operator/usage", [["get", "getOperatorUsage", "Read platform-wide operator usage", "platform_operator", false]]],
  ["/api/v1/projects", [["post", "createProject", "Create an empty project scope", "admin"]]],
  ["/api/v1/projects/{projectId}/retrieval", [["get", "retrieveProject", "Search the selected project across Nox services", "member"]]],
  ["/api/v1/projects/{projectId}/telemetry/dashboard", [["get", "getProjectTelemetryDashboard", "Read the selected project's Telemetry dashboard", "member"]]],
  ["/api/v1/projects/{projectId}/telemetry/stat-events", [["get", "listProjectTelemetryStatEvents", "List accepted Telemetry events for the selected project", "member"]]],
  ["/api/v1/projects/{projectId}/telemetry/alerts", [["get", "listProjectTelemetryAlerts", "List Telemetry alerts for the selected project", "member"]]],
  ["/api/v1/projects/{projectId}/telemetry/alert-rules", [["get", "listProjectTelemetryAlertRules", "List effective Telemetry alert rules for the selected project", "member"]]],
  ["/api/v1/projects/{projectId}/backfill-prs", [["post", "backfillProjectPullRequests", "Queue bounded Activity pull-request history", "admin"]]],
  ["/api/v1/recover-repo-history", [["post", "recoverRepositoryHistory", "Recover bounded repository history", "admin"]]],
  ["/api/v1/search", [["get", "searchWorkspace", "Search tracked work and people", "member"]]],
  ["/api/v1/slack/disconnect", [["post", "disconnectSlackWorkspace", "Disconnect one Slack workspace", "admin"]]],
  ["/api/v1/slack/status", [["get", "getSlackStatus", "Read Slack connections and delivery health", "member"]]],
  ["/api/v1/slack/test", [["post", "testSlackDestination", "Send a test message to a Slack destination", "admin"]]],
  ["/api/v1/feedback/project-overview", [["get", "getFeedbackProjectOverview", "Read a guest-safe Feedback project overview", "member"]]],
  ["/api/v1/feedback/reports/{reportId}", [["get", "getFeedbackReport", "Read a Feedback report and its evidence", "member"]]],
  ["/api/v1/feedback/assets/{assetId}", [["get", "downloadFeedbackAsset", "Download authenticated Feedback evidence", "member"]]],
  ["/api/v1/activity/current-summary", [["get", "getCurrentWorkSummary", "Read per-person current-work counts for the selected project", "member"]]],
  ["/api/v1/sync", [
    ["get", "getSyncStatus", "Read GitHub synchronization freshness", "member"],
    ["post", "syncGitHubData", "Synchronize bounded GitHub data", "admin"],
  ]],
  ["/api/v1/sync-events", [["post", "syncGitHubEvents", "Backfill bounded GitHub activity events", "admin"]]],
  ["/api/v1/teams", [["get", "listGitHubTeams", "List teams visible through the connected GitHub organization", "member"]]],
];
delete document.paths["/api/v1/projects/{projectId}"];
for (const [path, methods] of clientRouteContracts) {
  document.paths[path] ??= {};
  const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name, in: "path", required: true, schema: { type: "string", minLength: 1 },
  }));
  if (pathParameters.length) document.paths[path].parameters ??= pathParameters;
  for (const [method, operationId, summary, role, organization = true] of methods) {
    document.paths[path][method] ??= firstPartyClientOperation(operationId, summary, role, organization, method);
  }
}
document.paths["/api/v1/telemetry/project-overview"].get["x-guest-access"] = "read";
document.paths["/api/v1/feedback/project-overview"].get["x-guest-access"] = "read";
document.paths["/api/v1/feedback/assets/{assetId}"].get.responses["200"] = {
  description: "Authenticated Feedback evidence bytes",
  content: {
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/jpeg": { schema: { type: "string", format: "binary" } },
    "image/webp": { schema: { type: "string", format: "binary" } },
  },
};
document.paths["/api/v1/feedback/assets/{assetId}"].get.responses["404"] = { "$ref": "#/components/responses/V1Error" };
document.paths["/api/v1/feedback/assets/{assetId}"].get.responses["410"] = { "$ref": "#/components/responses/V1Error" };
for (const path of ["/api/v1/tasks", "/api/v1/task-workflows", "/api/v1/projects/{projectId}/telemetry/dashboard"]) {
  if (document.paths[path]?.get) document.paths[path].get["x-guest-access"] = "read";
}
document.paths["/api/v1/auth/logout"].post["x-browser-session-only"] = true;
document.paths["/api/v1/projects"].post.requestBody.required = true;
document.paths["/api/v1/projects"].post.responses["201"] ??= document.paths["/api/v1/projects"].post.responses["200"];
delete document.paths["/api/v1/projects"].post.responses["200"];
document.paths["/api/v1/activity/current-summary"].get.tags = ["Activity"];
for (const path of ["dashboard", "stat-events", "alerts", "alert-rules"]) {
  document.paths[`/api/v1/projects/{projectId}/telemetry/${path}`].get.tags = ["Telemetry"];
}

document.paths["/api/v1/telemetry/github-issues"] = {
  get: {
    operationId: "getTelemetryGitHubIssueSettings",
    summary: "List project GitHub-incident settings",
    description: "Returns each active project's repository mapping, routing policy, and open Telemetry incident count.",
    "x-required-role": "admin",
    responses: { "200": { description: "Project incident settings" } },
  },
  put: {
    operationId: "putTelemetryGitHubIssueSettings",
    summary: "Update project GitHub-incident settings",
    description: "Controls whether Telemetry opens or updates a GitHub issue for incidents in the selected project and environments.",
    "x-required-role": "admin",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { "$ref": "#/components/schemas/TelemetryGitHubIssueSettingsUpdate" } } },
    },
    responses: {
      "200": { description: "Project incident settings updated" },
      "404": { description: "Active project not found" },
      "409": { description: "Project has no linked GitHub repository" },
    },
  },
};

function automationScope(path, method) {
  const access = method === "get" ? "read" : "write";
  if (method === "post" && path === "/api/v1/developer-feedback") return "developer-feedback:write";
  if (method === "post" && path === "/api/v1/integrations/slack/messages") return "slack:send";
  if (method === "post" && ["/api/v1/slack/test", "/api/v1/integrations/slack/test"].includes(path)) return "slack:send";
  if (method === "get" && path === "/api/v1/slack/channels") return "slack:read";
  if (method === "post" && path === "/api/v1/telemetry/public/events") return "telemetry:ingest";
  if (method === "post" && path === "/api/v1/growth/events") return "growth:ingest";
  if (method === "post" && path === "/api/v1/usage/events") return "usage:ingest";
  if (method === "get" && path === "/api/v1/services") return "services:read";
  const service = path.match(/^\/api\/v1\/services\/(activity|feedback|telemetry)(?:\/(?:setup|health))?$/)?.[1];
  if (method === "get" && service) return `${service}:read`;
  if (method === "get" && path === "/api/v1/activity") return "activity:read";
  if (/^\/api\/v1\/(?:features|tasks|task-workflows|specs|assign|issue-state|planning)(?:\/|$)/.test(path)) return `planning:${access}`;
  path = compatibilityApiPath(path);
  if (method === "get" && /^\/api\/(?:issues|prs)(?:\/|$)/.test(path)) return "activity:read";
  if (/^\/api\/feedback\/sites(?:\/|$)/.test(path)) return `feedback:${access}`;
  if (/^\/api\/v1\/growth(?:\/|$)/.test(path) || /^\/api\/v1\/projects\/[^/]+\/growth(?:\/|$)/.test(path)) return `growth:${access}`;
  if (/^\/api\/v1\/usage(?:\/|$)/.test(path) || /^\/api\/v1\/projects\/[^/]+\/usage(?:\/|$)/.test(path)) return `usage:${access}`;
  if (/^\/api\/v1\/projects\/[^/]+\/(?:issues\/(?:alerts|alert-rules)|incidents)(?:\/|$)/.test(path)) return `issues:${access}`;
  if (/^\/api\/telemetry\/sources(?:\/|$)/.test(path)) return `telemetry:${access}`;
  if (method === "get" && (path === "/api/telemetry/events" || path === "/api/telemetry/metrics")) return "telemetry:read";
  if (/^\/api\/telemetry\/projects\/[^/]+\/metrics$/.test(path)) return `telemetry:${access}`;
  return null;
}

document.paths["/api/v1/telemetry/errors/{sourceId}/{fingerprint}"] = {
  put: {
    operationId: "updateTelemetryErrorStatus",
    summary: "Update an error incident status",
    description: "Acknowledge, resolve, or reopen one Telemetry error group in the optional project context.",
    parameters: [
      { name: "sourceId", in: "path", required: true, schema: { type: "string" } },
      { name: "fingerprint", in: "path", required: true, schema: { type: "string" } },
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema: {
        type: "object", additionalProperties: false, required: ["status"],
        properties: { status: { type: "string", enum: ["open", "acknowledged", "resolved"] } },
      } } },
    },
    responses: { "200": { description: "Error incident status updated" }, "404": { description: "Error incident not found" } },
    "x-required-role": "admin",
  },
};

document.paths["/api/v1/api-tokens"] = {
  get: apiTokenOperation("listApiTokens", "List redacted API-token metadata", "200"),
  post: {
    ...apiTokenOperation("createApiToken", "Create a scoped API token", "201"),
    requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/ApiTokenCreate" } } } },
  },
};
document.paths["/api/v1/developer-feedback"] = {
  post: {
    operationId: "submitDeveloperFeedback",
    summary: "Submit actionable API or product feedback",
    description: "Records one firsthand observation from a developer tool or AI agent. Do not include credentials, personal data, prompts, or full request and response bodies. Use one stable idempotency key per observation and do not post routine success reports.",
    requestBody: {
      required: true,
      content: { "application/json": { schema: { "$ref": "#/components/schemas/DeveloperFeedbackCreate" } } },
    },
    responses: {
      "202": {
        description: "Feedback received or previously received under the same idempotency key",
        content: { "application/json": { schema: { "$ref": "#/components/schemas/DeveloperFeedbackReceipt" } } },
      },
      "413": { "$ref": "#/components/responses/V1Error" },
      "415": { "$ref": "#/components/responses/V1Error" },
      "422": { "$ref": "#/components/responses/V1Error" },
      "503": { "$ref": "#/components/responses/V1Error" },
    },
  },
};
document.paths["/api/v1/api-tokens/{id}"] = {
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  delete: apiTokenOperation("revokeApiToken", "Revoke an API token", "200"),
};
document.paths["/api/v1/api-tokens/{id}/rotate"] = {
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  post: apiTokenOperation("rotateApiToken", "Rotate an API token and return its replacement once", "201"),
};

const oldTelemetryPath = document.paths["/v1/events"];
if (oldTelemetryPath) {
  document.paths["/api/v1/telemetry/public/events"] = oldTelemetryPath;
  delete document.paths["/v1/events"];
}
const telemetryIngest = document.paths["/api/v1/telemetry/public/events"].post;
delete telemetryIngest.servers;
telemetryIngest.security = [{ telemetryKey: [] }, { noxApiToken: [] }];
telemetryIngest.summary = "Submit one standardized Telemetry event through the stable NoxHere gateway";
telemetryIngest.description = "Server applications authenticate with a project-scoped NoxHere API token carrying telemetry:ingest. Browser capture continues to use X-Nox-Ingest-Key with a publishable source key. Supply eventId or idempotencyKey when retrying error and feature events. User lifecycle facts are intrinsically deduplicated by source, user, type, and period.";
telemetryIngest.responses["202"].content = { "application/json": { schema: { "$ref": "#/components/schemas/TelemetryIngestResponse" } } };
telemetryIngest.requestBody.content["application/json"].examples = {
  anonymousWebsiteActivity: {
    summary: "Anonymous count-only browser activity",
    value: {
      version: 1, type: "activity.tracked", eventId: "8f7ec5e2-e8d3-4e08-a185-7fd4966e9529",
      occurredAt: "2026-10-09T08:00:00.000Z", environment: "production",
      name: "website.signup_clicked", value: 1,
    },
  },
  protectedServerActivity: {
    summary: "Server activity with an SDK-protected identity",
    value: {
      version: 1, type: "activity.tracked", eventId: "21f7b6ad-3648-4515-b086-b7a2a69de1bf",
      occurredAt: "2026-10-09T08:00:00.000Z", environment: "production",
      name: "custom.records.parsed", userId: "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40", value: 1,
    },
  },
};
telemetryIngest.responses["413"] = { description: "Payload exceeds 32 KiB", content: { "application/json": { schema: { "$ref": "#/components/schemas/LegacyError" } } } };
telemetryIngest.responses["415"] = { description: "Content-Type must be application/json", content: { "application/json": { schema: { "$ref": "#/components/schemas/LegacyError" } } } };

const browserErrors = document.paths["/api/feedback/public/v1/errors"].post;
browserErrors.requestBody = {
  required: true,
  content: { "application/json": { schema: { "$ref": "#/components/schemas/FeedbackErrorBatch" } } },
};

const queryParameters = {
  "/api/v1/activity": [
    parameter("mode", { type: "string", enum: ["opened", "merged", "release-notes"], default: "merged" }, "Feed event mode"),
    parameter("repo", { type: "string", maxLength: 200 }, "Repository name"),
    parameter("actor", { type: "string", maxLength: 100 }, "GitHub login"),
    parameter("limit", { type: "integer", minimum: 1, maximum: 200, default: 25 }, "Maximum events"),
    parameter("before", { type: "string", maxLength: 200 }, "Composite cursor returned by the previous page"),
  ],
  "/api/v1/issues": [
    parameter("state", { type: "string" }, "Issue state filter"),
    parameter("repo", { type: "string" }, "Repository name"),
    parameter("page", { type: "integer", minimum: 1, default: 1 }, "Page number"),
    parameter("page_size", { type: "integer", minimum: 1, maximum: 5000, default: 30 }, "Results per page"),
    parameter("sort", { type: "string" }, "Sort field"),
    parameter("sort_dir", { type: "string", enum: ["asc", "desc"] }, "Sort direction"),
  ],
  "/api/v1/prs": [
    parameter("state", { type: "string" }, "Pull-request state filter"),
    parameter("author", { type: "string" }, "GitHub author login"),
    parameter("repo", { type: "string" }, "Repository name"),
    parameter("page", { type: "integer", minimum: 1, default: 1 }, "Page number"),
    parameter("page_size", { type: "integer", minimum: 1, maximum: 500, default: 100 }, "Results per page"),
  ],
  "/api/v1/telemetry/events": [
    parameter("sourceId", { type: "string", format: "uuid" }, "Optional source filter"),
    parameter("limit", { type: "integer", minimum: 1, maximum: 100, default: 25 }, "Maximum recent events"),
  ],
};
for (const [path, parameters] of Object.entries(queryParameters)) {
  document.paths[path].get.parameters = parameters;
}

delete document.components.schemas.ActivityConfigPatch?.properties?.projectScope;

// Feature attachments use the same bounded storage contract as specification
// attachments, but are addressed by the feature number.
const featureAttachmentsPath = "/api/v1/features/{number}/attachments";
const featureAttachmentPath = `${featureAttachmentsPath}/{attachmentId}`;
document.paths[featureAttachmentsPath] = structuredClone(document.paths["/api/v1/specs/{specId}/attachments"]);
document.paths[featureAttachmentPath] = structuredClone(document.paths["/api/v1/specs/{specId}/attachments/{attachmentId}"]);
for (const operation of Object.values(document.paths[featureAttachmentsPath])) {
  operation.parameters = operation.parameters.map((entry) => entry.$ref === "#/components/parameters/specId"
    ? { "$ref": "#/components/parameters/number" }
    : entry);
}
for (const operation of Object.values(document.paths[featureAttachmentPath])) {
  operation.parameters = operation.parameters.map((entry) => entry.$ref === "#/components/parameters/specId"
    ? { "$ref": "#/components/parameters/number" }
    : entry);
}
document.paths[featureAttachmentsPath].get.operationId = "listFeatureAttachments";
document.paths[featureAttachmentsPath].get.summary = "List feature attachments";
document.paths[featureAttachmentsPath].get.description = "List attachments for one Planning feature.";
document.paths[featureAttachmentsPath].post.operationId = "uploadFeatureAttachment";
document.paths[featureAttachmentsPath].post.summary = "Upload a bounded feature attachment";
document.paths[featureAttachmentsPath].post.description = "Upload a bounded attachment to one Planning feature.";
document.paths[featureAttachmentPath].get.operationId = "downloadFeatureAttachment";
document.paths[featureAttachmentPath].get.summary = "Download a feature attachment";
document.paths[featureAttachmentPath].get.description = "Download one attachment from a Planning feature.";
document.paths[featureAttachmentPath].delete.operationId = "deleteFeatureAttachment";
document.paths[featureAttachmentPath].delete.summary = "Delete a feature attachment";
document.paths[featureAttachmentPath].delete.description = "Delete one attachment from a Planning feature.";

const projectParameter = { "$ref": "#/components/parameters/projectId" };
const incidentParameter = { name: "incidentId", in: "path", required: true, schema: { type: "string", pattern: "^inc_[a-f0-9]{32}$" } };
function projectCapabilityOperation(operationId, summary, { write = false, incident = false } = {}) {
  return {
    operationId,
    summary,
    parameters: [projectParameter, ...(incident ? [incidentParameter] : [])],
    ...(write ? { requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/ApiRecord" } } } } } : {}),
    responses: {
      "200": { description: "Capability response", content: { "application/json": { schema: { "$ref": "#/components/schemas/ApiRecord" } } } },
      "400": { "$ref": "#/components/responses/V1Error" },
      "401": { "$ref": "#/components/responses/V1Error" },
      "403": { "$ref": "#/components/responses/V1Error" },
      "404": { "$ref": "#/components/responses/V1Error" },
      "409": { "$ref": "#/components/responses/V1Error" },
    },
  };
}

document.paths["/api/v1/projects/{projectId}/activity"] = { get: projectCapabilityOperation("getProjectActivity", "Read project activity") };
document.paths["/api/v1/projects/{projectId}/issues"] = { get: projectCapabilityOperation("getProjectIssues", "Read project issues") };
document.paths["/api/v1/projects/{projectId}/feedback"] = { get: projectCapabilityOperation("getProjectFeedback", "Read project feedback") };
document.paths["/api/v1/projects/{projectId}/incidents"] = { get: projectCapabilityOperation("getProjectIncidents", "Read project incidents") };
document.paths["/api/v1/projects/{projectId}/incidents/{incidentId}"] = {
  get: projectCapabilityOperation("getProjectIncident", "Read one project incident", { incident: true }),
  patch: projectCapabilityOperation("updateProjectIncident", "Update one project incident", { write: true, incident: true }),
};
document.paths["/api/v1/projects/{projectId}/incidents/{incidentId}"].patch.requestBody.content["application/json"].schema = { "$ref": "#/components/schemas/ProjectIncidentUpdate" };
document.paths["/api/v1/projects/{projectId}/telemetry/dashboard"] = { get: projectCapabilityOperation("getTelemetryProjectDashboard", "Read the project Telemetry dashboard") };
document.paths["/api/v1/projects/{projectId}/telemetry/actions"] = {
  get: projectCapabilityOperation("getTelemetryProjectActions", "Read project Telemetry actions"),
  put: projectCapabilityOperation("updateTelemetryProjectActions", "Update project Telemetry actions", { write: true }),
};
document.paths["/api/v1/projects/{projectId}/telemetry/alerts"] = { get: projectCapabilityOperation("getTelemetryProjectAlerts", "Read project Telemetry alerts") };
document.paths["/api/v1/projects/{projectId}/telemetry/alert-rules"] = { get: projectCapabilityOperation("getTelemetryProjectAlertRules", "Read project Telemetry alert rules") };
document.paths["/api/v1/projects/{projectId}/telemetry/stat-events"] = { get: projectCapabilityOperation("getTelemetryProjectStatEvents", "Read project Telemetry statistic events") };

setJsonSuccessSchema("/api/v1/activity", "get", "ActivityPage");
for (const path of ["/api/v1/issues", "/api/v1/prs"]) setJsonSuccessSchema(path, "get", "RecordCollection");
for (const path of ["/api/v1/issues/{repo}/{number}", "/api/v1/prs/{repo}/{number}", "/api/v1/engineer-activity", "/api/v1/engineer-stats", "/api/v1/events", "/api/v1/events/{id}", "/api/v1/github/comments", "/api/v1/github/details", "/api/v1/search"]) {
  setJsonSuccessSchema(path, "get", "ApiRecord");
}
setJsonSuccessSchema("/api/v1/activity/release-notes-prompt", "get", "ApiRecord");
setJsonSuccessSchema("/api/v1/llm-settings", "get", "ApiRecord");
setJsonSuccessSchema("/api/v1/llm-settings", "put", "MutationReceipt");
setJsonSuccessSchema("/api/v1/prs/close", "post", "MutationReceipt");
setJsonSuccessSchema("/api/v1/prs/merge", "post", "MutationReceipt");
setJsonSuccessSchema("/api/v1/features", "get", "FeatureList");
setJsonSuccessSchema("/api/v1/features", "post", "Feature");
setJsonSuccessSchema("/api/v1/features/{number}", "patch", "Feature");
setJsonSuccessSchema("/api/v1/features/{number}", "delete", "MutationReceipt");
setJsonSuccessSchema(featureAttachmentsPath, "get", "SpecAttachmentList");
setJsonSuccessSchema(featureAttachmentsPath, "post", "SpecAttachment");
setJsonSuccessSchema(featureAttachmentPath, "delete", "MutationReceipt");
setJsonSuccessSchema("/api/v1/specs", "get", "SpecList");
setJsonSuccessSchema("/api/v1/specs", "post", "Spec");
setJsonSuccessSchema("/api/v1/specs/{specId}", "get", "Spec");
setJsonSuccessSchema("/api/v1/specs/{specId}", "patch", "Spec");
setJsonSuccessSchema("/api/v1/specs/{specId}/archive", "post", "MutationReceipt");
setJsonSuccessSchema("/api/v1/specs/{specId}/archive", "delete", "MutationReceipt");
setJsonSuccessSchema("/api/v1/specs/{specId}/attachments", "get", "SpecAttachmentList");
setJsonSuccessSchema("/api/v1/specs/{specId}/attachments", "post", "SpecAttachment");
setJsonSuccessSchema("/api/v1/specs/{specId}/attachments/{attachmentId}", "delete", "MutationReceipt");
setJsonSuccessSchema("/api/v1/assign", "post", "ApiRecord");
setJsonSuccessSchema("/api/v1/issue-state", "post", "MutationReceipt");
setJsonSuccessSchema("/api/v1/projects/{projectId}/telemetry/dashboard", "get", "StatsDashboard");
for (const method of ["get", "put"]) setJsonSuccessSchema("/api/v1/projects/{projectId}/telemetry/actions", method, "TelemetryActions");
setJsonSuccessSchema("/api/v1/projects/{projectId}/telemetry/stat-events", "get", "StatEventList");
setJsonSuccessSchema("/api/v1/projects/{projectId}/telemetry/alerts", "get", "IncidentAlertList");
setJsonSuccessSchema("/api/v1/projects/{projectId}/telemetry/alert-rules", "get", "IncidentAlertRuleList");
setJsonSuccessSchema("/api/v1/projects/{projectId}/incidents", "get", "ProjectIncidentOverview");
for (const method of ["get", "patch"]) setJsonSuccessSchema("/api/v1/projects/{projectId}/incidents/{incidentId}", method, "ProjectIncidentResponse");

for (const [path, pathItem] of Object.entries(document.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!new Set(["get", "post", "put", "patch", "delete"]).has(method)) continue;
    const isV1 = path.startsWith("/api/v1/");
    if (isV1) {
      for (const status of Object.keys(operation.responses)) {
        if (/^[45]/.test(status) || status === "default") {
          operation.responses[status] = status === "429"
            ? { "$ref": "#/components/responses/RateLimited" }
            : status === "413"
              ? { "$ref": "#/components/responses/PayloadTooLarge" }
              : { "$ref": "#/components/responses/V1Error" };
        }
      }
      for (const status of ["400", "401", "403", "409", "429"]) {
        operation.responses[status] ??= status === "429"
          ? { "$ref": "#/components/responses/RateLimited" }
          : { "$ref": "#/components/responses/V1Error" };
      }
    }
    operation.tags = [serviceTag(path)];
    operation.description ??= `${operation.summary || `${method.toUpperCase()} ${path}`}. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.`;
    operation["x-authentication"] = authenticationFor(operation);
    delete operation["x-project-scope"];
    delete operation["x-automation-scope"];
    if (acceptsOptionalProjectContext(operation)) {
      operation.parameters ??= [];
      if (!operation.parameters.some((entry) => entry?.$ref === "#/components/parameters/projectContext")) {
        operation.parameters.unshift({ "$ref": "#/components/parameters/projectContext" });
      }
      operation["x-project-scope"] = "optional";
    }
    if (["/api/v1/telemetry/public/events", "/api/v1/growth/events", "/api/v1/usage/events"].includes(path) && method === "post") {
      operation.parameters ??= [];
      if (!operation.parameters.some((entry) => entry?.$ref === "#/components/parameters/telemetrySourceContext")) {
        operation.parameters.push({ "$ref": "#/components/parameters/telemetrySourceContext" });
      }
    }
    if (!isV1 && ["member", "admin"].includes(operation["x-authentication"])) {
      operation.responses["401"] ??= { description: "Authentication required" };
      operation.responses["403"] ??= { description: "Insufficient access" };
      if (/^\/api\/(?:features|specs|spots|cues)(?:\/|$)/.test(path) || path === "/api/v1/activity") {
        operation.responses["409"] ??= { description: "Product service is not enabled" };
      }
    }
    if (["member", "admin"].includes(operation["x-authentication"])) {
      const organization = operation["x-organization-optional"] ? false : true;
      const browser = { browserSession: [], ...(organization ? { organization: [] } : {}), ...(!["get", "head", "options"].includes(method) ? { csrfProof: [] } : {}) };
      const native = { nativeSession: [], ...(organization ? { organization: [] } : {}) };
      const scope = !operation["x-browser-session-only"] ? automationScope(path, method) : null;
      operation.security = operation["x-browser-session-only"] ? [browser] : [browser, native, ...(scope ? [{ noxApiToken: [] }] : [])];
      if (scope) operation["x-automation-scope"] = scope;
    } else if (operation["x-authentication"] === "platform_operator") {
      operation.security = [
        { browserSession: [], ...(!["get", "head", "options"].includes(method) ? { csrfProof: [] } : {}) },
        { nativeSession: [] },
      ];
    } else if (operation["x-authentication"] === "ingest_key"
        && operation.security?.some((entry) => Object.hasOwn(entry, "noxApiToken"))) {
      operation["x-automation-scope"] = automationScope(path, method);
    }
    operation["x-change-safety"] = changeSafety(method, operation.operationId);
    for (const [status, response] of Object.entries(operation.responses)) {
      if (response.$ref || status === "204" || response.content) continue;
      const schema = path.includes("/attachments/{attachmentId}") && method === "get" && status.startsWith("2")
        ? { type: "string", format: "binary" }
        : { "$ref": status.startsWith("2") ? "#/components/schemas/JsonValue" : "#/components/schemas/LegacyError" };
      const mediaType = schema.format === "binary" ? "application/octet-stream" : "application/json";
      response.content = { [mediaType]: { schema } };
    }
  }
}

const formatted = `${JSON.stringify(document, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (formatted !== original) {
    console.error("public/openapi.json is not standardized; run npm run openapi:standardize");
    process.exitCode = 1;
  }
} else {
  await writeFile(target, formatted);
}

function parameter(name, schema, description) {
  return { name, in: "query", required: false, description, schema };
}

function setJsonSuccessSchema(path, method, schemaName) {
  const operation = document.paths[path]?.[method];
  if (!operation) throw new Error(`Missing ${method.toUpperCase()} ${path} while assigning ${schemaName}`);
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!status.startsWith("2") || status === "204") continue;
    response.content = { "application/json": { schema: { "$ref": `#/components/schemas/${schemaName}` } } };
  }
}

function apiTokenOperation(operationId, summary, successStatus) {
  return {
    operationId,
    summary,
    description: "Requires an authenticated organization-admin browser or native CLI session. API tokens cannot manage other API tokens.",
    security: [{ browserSession: [], organization: [] }, { nativeSession: [], organization: [] }],
    responses: {
      [successStatus]: { description: "Success", content: { "application/json": { schema: { "$ref": "#/components/schemas/JsonValue" } } } },
    },
    "x-required-role": "admin",
  };
}

function nativeAuthOperation(operationId, summary, requestSchema, description) {
  return {
    operationId,
    summary,
    description,
    security: [],
    requestBody: { required: true, content: { "application/json": { schema: requestSchema } } },
    responses: {
      "200": { description: "Success", content: { "application/json": { schema: { "$ref": "#/components/schemas/JsonValue" } } } },
      "202": { description: "Authorization is still pending" },
      "400": { description: "Invalid, expired, or rejected authorization" },
      "401": { description: "Invalid or expired credential" },
      "429": { description: "Polling faster than the advertised interval" },
      "503": { description: "Authentication provider temporarily unavailable" },
    },
  };
}

function firstPartyClientOperation(operationId, summary, role, organization, method) {
  const requestBody = ["post", "put", "patch"].includes(method);
  const security = role === "platform_operator"
    ? [{ browserSession: [] }, { nativeSession: [] }]
    : organization === false
      ? [{ browserSession: [] }, { nativeSession: [] }]
      : undefined;
  return {
    operationId,
    summary,
    description: "Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.",
    ...(security ? { security } : {}),
    ...(requestBody ? { requestBody: {
      required: false,
      content: { "application/json": { schema: { "$ref": "#/components/schemas/JsonValue" } } },
    } } : {}),
    responses: { "200": { description: "Success" } },
    "x-required-role": role,
    "x-first-party-client": true,
    "x-organization-optional": !organization,
  };
}

function serviceTag(path) {
  const compatibilityPath = compatibilityApiPath(path);
  if (/^\/api\/v1\/(?:growth)(?:\/|$)/.test(path) || /^\/api\/v1\/projects\/[^/]+\/growth(?:\/|$)/.test(path)) return "Growth";
  if (/^\/api\/v1\/(?:usage)(?:\/|$)/.test(path) || /^\/api\/v1\/projects\/[^/]+\/usage(?:\/|$)/.test(path)) return "Usage";
  if (/^\/api\/v1\/projects\/[^/]+\/issues\/(?:alerts|alert-rules)(?:\/|$)/.test(path)) return "Issues";
  if (/^\/api\/(?:features|specs|assign|issue-state)(?:\/|$)/.test(compatibilityPath)) return "Planning";
  if (/^\/api\/v1\/activity(?:\/|$)/.test(path)
      || /^\/api\/(?:issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|activity)(?:\/|$)/.test(compatibilityPath)
      || /^\/api\/github\/(?:comments|details)$/.test(compatibilityPath)) return "Activity";
  if (compatibilityPath.startsWith("/api/feedback")) return "Feedback";
  if (/^\/api\/v1\/projects\/[^/]+\/incidents(?:\/|$)/.test(path)
      || /^\/api\/telemetry\/(?:github-issues|errors)(?:\/|$)/.test(compatibilityPath)
      || /^\/api\/telemetry\/sources\/[^/]+\/features(?:\/|$)/.test(compatibilityPath)
      || /^\/api\/v1\/projects\/[^/]+\/telemetry\/(?:alerts|alert-rules)(?:\/|$)/.test(path)) return "Incidents";
  if (compatibilityPath.startsWith("/api/telemetry") || /^\/api\/v1\/projects\/[^/]+\/telemetry(?:\/|$)/.test(path)) return "Stats";
  return "NoxHere";
}

function acceptsOptionalProjectContext(operation) {
  if (operation["x-authentication"] === "public" || operation["x-organization-optional"]) return false;
  return ["member", "admin"].includes(operation["x-authentication"]);
}

function canonicalApiPath(path) {
  if (path.startsWith("/api/v1/")) return path;
  if (path.startsWith("/api/feedback/public/v1/")) return path;
  if (path === "/api/telemetry/public/v1/events") return "/api/v1/telemetry/public/events";
  if (path === "/api/projects/routing/{projectId}") return "/api/v1/projects/{projectId}/routing";
  if (path.startsWith("/api/")) return path.replace(/^\/api\//, "/api/v1/");
  return path;
}

function compatibilityApiPath(path) {
  if (!path.startsWith("/api/v1/")) return path;
  if (/^\/api\/v1\/(?:services|api-tokens|activity)(?:\/|$)/.test(path)) return path;
  if (/^\/api\/v1\/projects\/[^/]+\/routing$/.test(path)) return path.replace(
    /^\/api\/v1\/projects\/([^/]+)\/routing$/,
    "/api/projects/routing/$1",
  );
  if (path === "/api/v1/telemetry/public/events") return "/api/telemetry/public/v1/events";
  return path.replace(/^\/api\/v1\//, "/api/");
}

function authenticationFor(operation) {
  if (operation["x-required-role"] === "platform_operator") return "platform_operator";
  if (operation["x-native-refresh"]) return "native_refresh";
  if (Array.isArray(operation.security) && operation.security.length === 0) return "public";
  if (operation.security?.some((entry) => Object.hasOwn(entry, "telemetryKey"))) return "ingest_key";
  if (operation.security?.length === 1 && Object.hasOwn(operation.security[0], "nativeSession")) return "native_session";
  const adminOperations = new Set([
    "startConnection", "disconnectConnection", "assignSlackConnectionProject",
    "getSlackRouting", "patchSlackRouting", "testSlackRoute", "archiveProject",
    "restoreProject", "acknowledgeRepositories", "updateActor", "archiveSpec",
    "restoreSpec", "closePullRequest", "mergePullRequest", "getLlmSettings", "putLlmSettings",
    "createFeedbackSite", "updateFeedbackSite", "deleteFeedbackSite",
    "retryFeedbackDeliveries", "listTelemetrySources", "createTelemetrySource",
    "updateTelemetrySource", "deleteTelemetrySource", "createTelemetryKey",
    "revokeTelemetryKey", "listTelemetryEvents", "getTelemetryDailyHealth",
    "patchNoxServiceConfig",
    "getTelemetryGitHubIssueSettings", "putTelemetryGitHubIssueSettings",
  ]);
  return operation["x-required-role"] === "admin" || adminOperations.has(operation.operationId) ? "admin" : "member";
}

function changeSafety(method, operationId) {
  if (method === "get") return "safe_read";
  if (operationId === "submitDeveloperFeedback") return "idempotent_with_key";
  if (["patchNoxServiceConfig", "updateFeedbackResolutionTemplate"].includes(operationId)) return "conditional_write";
  if (operationId === "ingestTelemetryEvent") return "idempotent_with_event_key";
  if (method === "delete" || /disconnect|archive|close|merge|revoke|delete/i.test(operationId)) return "destructive";
  return "write_not_safe_to_retry";
}
