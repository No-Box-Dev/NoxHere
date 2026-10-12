# Generated from packages/sdk-contract/public-api.json. Do not edit by hand.
from typing import Any, Literal, TypeAlias, Union
from typing_extensions import NotRequired, Required, TypedDict

JsonPrimitive: TypeAlias = None | bool | int | float | str

class ActivityActor(TypedDict, total=False):
    avatarUrl: Required[Union[str, None]]
    login: Required[str]
    name: Required[Union[str, None]]

class ActivityConfigPatch(TypedDict, total=False):
    releaseNotesPrompt: NotRequired[Union[str, None]]

class ActivityEvent(TypedDict, total=False):
    actor: Required["ActivityActor"]
    createdAt: Required[str]
    id: Required[str]
    pr: Required[Union["ActivityPullRequest", None]]
    repo: Required[str]
    summary: Required[str]
    technicalSummary: Required[str]
    type: Required[Literal['opened', 'merged', 'release-notes']]

class ActivityPage(TypedDict, total=False):
    events: Required[list["ActivityEvent"]]
    nextCursor: Required[Union[str, None]]

class ActivityPullRequest(TypedDict, total=False):
    number: Required[int]
    title: Required[str]
    url: Required[str]

class ActorPatch(TypedDict, total=False):
    avatar_url: NotRequired[Union[str, None]]
    github_user_id: NotRequired[Union[str, None]]
    kind: NotRequired[Union[str, None]]
    name: NotRequired[Union[str, None]]
    tone: NotRequired[Union[str, None]]

class AiSettings(TypedDict, total=False):
    managed: Required["AiSettingsManaged"]
    mode: Required[Literal['disabled', 'managed']]

ApiRecord: TypeAlias = dict[str, Any]

class ApiTokenCreate(TypedDict, total=False):
    environment: NotRequired[Literal['live', 'test']]
    expiresInDays: NotRequired[int]
    name: Required[str]
    projectId: Required[str]
    scopes: Required[list[str]]

class ApiV1Error(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    error: Required["ApiV1ErrorError"]

class CapabilityOperation(TypedDict, total=False):
    authentication: Required[Literal['member', 'admin', 'public', 'ingest_key']]
    description: Required[str]
    id: Required[str]
    method: Required[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']]
    path: Required[str]

class DeveloperFeedbackCreate(TypedDict, total=False):
    area: Required[Literal['api', 'documentation', 'sdk', 'product', 'other']]
    category: Required[Literal['bug', 'friction', 'suggestion', 'missing_capability', 'other']]
    client: NotRequired["DeveloperFeedbackCreateClient"]
    details: Required[str]
    idempotencyKey: Required[str]
    impact: NotRequired[Literal['low', 'medium', 'high']]
    operationId: NotRequired[str]
    suggestedChange: NotRequired[str]
    summary: Required[str]

class DeveloperFeedbackReceipt(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    feedback: Required["DeveloperFeedbackReceiptFeedback"]

Feature: TypeAlias = ApiRecord

class FeatureCreate(TypedDict, total=False):
    backlog: NotRequired[bool]
    owners: NotRequired[list[str]]
    plan: NotRequired[str]
    status: NotRequired[str]
    title: Required[str]

FeatureList: TypeAlias = list["Feature"]

class FeaturePatch(TypedDict, total=False):
    backlog: NotRequired[bool]
    owners: NotRequired[list[str]]
    plan: NotRequired[str]
    state: NotRequired[Literal['open', 'closed']]
    status: NotRequired[str]
    title: NotRequired[str]

class FeedActor(TypedDict, total=False):
    avatarUrl: Required[Union[str, None]]
    login: Required[str]
    name: Required[Union[str, None]]

class FeedEvent(TypedDict, total=False):
    actor: Required["FeedActor"]
    createdAt: Required[str]
    id: Required[str]
    pr: Required[Union["FeedPullRequest", None]]
    repo: Required[str]
    summary: Required[str]
    technicalSummary: Required[str]
    type: Required[Literal['opened', 'merged', 'release-notes']]

class FeedPage(TypedDict, total=False):
    events: Required[list["FeedEvent"]]
    nextCursor: Required[Union[str, None]]

class FeedPullRequest(TypedDict, total=False):
    number: Required[int]
    title: Required[str]
    url: Required[str]

class FeedbackBlock(TypedDict, total=False):
    environments: NotRequired[list[str]]
    id: Required[str]
    label: NotRequired[Union[str, None]]
    options: NotRequired[list[str]]
    required: NotRequired[bool]
    type: Required[Literal['title', 'description', 'reporter', 'contact_email', 'category', 'custom_text', 'custom_textarea', 'custom_select', 'element_picker', 'metadata', 'console_logs']]

class FeedbackEnvironment(TypedDict, total=False):
    buttonColor: NotRequired[Union[str, None]]
    buttonText: NotRequired[Union[str, None]]
    captureMode: NotRequired[Literal['screenshot', 'dom', None]]
    enabled: NotRequired[bool]
    name: Required[str]
    url: Required[str]
    widgetMode: NotRequired[Literal['development', 'release', None]]

class FeedbackErrorBatch(TypedDict, total=False):
    errors: Required[list["FeedbackErrorBatchErrors"]]
    siteId: Required[str]

class FeedbackReport(TypedDict, total=False):
    blockValues: NotRequired[Union[dict[str, str], None]]
    context: NotRequired[Union[dict[str, Any], None]]
    description: NotRequired[Union[str, None]]
    elements: NotRequired[Union[list[dict[str, Any]], None]]
    environment: NotRequired[Union[str, None]]
    metadata: NotRequired[Union[dict[str, Any], None]]
    notifyOnResolution: NotRequired[bool]
    rating: NotRequired[Union[int, None]]
    reporter: NotRequired[Union[str, None]]
    reporterAvatarUrl: NotRequired[Union[str, None]]
    reporterEmail: NotRequired[Union[str, None]]
    screenshot: NotRequired[Union[str, None]]
    siteId: Required[str]
    title: Required[str]
    type: NotRequired[Literal['bug', 'feature', 'feedback']]

class FeedbackResolutionTemplate(TypedDict, total=False):
    acknowledgement: Required[str]
    appearance: Required["FeedbackResolutionTemplateAppearance"]
    buttonLabel: Required[str]
    closing: Required[str]
    reopenText: Required[str]
    replyTo: Required[Union[str, None]]
    senderName: Required[str]
    subject: Required[str]
    tone: Required[Literal['default', 'warm', 'formal', 'concise']]

class FeedbackResolutionTemplateDocument(TypedDict, total=False):
    defaults: Required["FeedbackResolutionTemplate"]
    revision: Required[str]
    template: Required["FeedbackResolutionTemplate"]
    usingDefault: Required[bool]

class FeedbackSiteCreate(TypedDict, total=False):
    autoErrorLogging: NotRequired[bool]
    buttonColor: NotRequired[str]
    buttonText: NotRequired[str]
    name: Required[str]
    projectId: Required[str]
    widgetMode: NotRequired[Literal['development', 'release']]

class FeedbackSitePatch(TypedDict, total=False):
    autoErrorLogging: NotRequired[bool]
    blocks: NotRequired[list["FeedbackBlock"]]
    buttonColor: NotRequired[str]
    buttonText: NotRequired[str]
    environments: NotRequired[list["FeedbackEnvironment"]]
    slackChannelId: NotRequired[Union[str, None]]
    slackConnectionId: NotRequired[Union[str, None]]
    widgetMode: NotRequired[Literal['development', 'release']]

class IncidentAlert(TypedDict, total=False):
    environment: Required[str]
    fingerprint: Required[str]
    happenedAt: Required[str]
    id: Required[str]
    occurrences: Required[int]
    sourceId: Required[str]
    status: Required[Literal['active', 'resolved']]
    summary: Required[str]
    title: Required[str]

IncidentAlertList: TypeAlias = list["IncidentAlert"]

class IncidentAlertRule(TypedDict, total=False):
    condition: Required[str]
    enabled: Required[bool]
    environment: Required[str]
    id: Required[str]
    kind: Required[Literal['feature', 'error', 'health']]
    name: Required[str]
    source: Required[str]

IncidentAlertRuleList: TypeAlias = list["IncidentAlertRule"]

JsonValue: TypeAlias = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]

class LegacyError(TypedDict, total=False):
    error: Required[str]

class ManagedAiServiceStatus(TypedDict, total=False):
    available: Required[bool]
    model: Required[str]
    provider: Required[str]

class MutationReceipt(TypedDict, total=False):
    ok: NotRequired[bool]
    status: NotRequired[str]
    updatedAt: NotRequired[str]

class NoxHereConfigPatch(TypedDict, total=False):
    enabledServices: NotRequired["NoxHereConfigPatchEnabledServices"]
    newRepositoryPolicy: NotRequired[Literal['include', 'exclude']]

class NoxService(TypedDict, total=False):
    capabilities: Required[list["ServiceCapability"]]
    description: Required[str]
    enabled: Required[bool]
    focus: Required[str]
    id: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]
    kind: Required[Literal['foundation', 'product']]
    links: Required["NoxServiceLinks"]
    name: Required[str]
    setup: Required["ServiceSetup"]

class OrganizationReference(TypedDict, total=False):
    login: Required[str]

class PaginatedRecords(TypedDict, total=False):
    data: Required[list["ApiRecord"]]
    page: Required[int]
    pageSize: Required[int]
    totalCount: Required[int]

class PlanningAssistFeature(TypedDict, total=False):
    number: Required[int]
    owners: NotRequired[list[str]]
    title: Required[str]

class PlanningAssistRequest(TypedDict, total=False):
    features: NotRequired[list["PlanningAssistFeature"]]
    kind: Required[Literal['feature', 'task']]
    owner: NotRequired[str]
    prompt: Required[str]

class PlanningAssistResponse(TypedDict, total=False):
    draft: Required["PlanningAssistResponseDraft"]

class PlanningConfigPatch(TypedDict, total=False):
    featureRepository: NotRequired[Union[str, None]]
    workflow: NotRequired["PlanningConfigPatchWorkflow"]

class PlanningTask(TypedDict, total=False):
    color: Required["PlanningTaskColor"]
    completedAt: Required[Union[str, None]]
    createdAt: Required[str]
    createdBy: Required[str]
    featureNumber: Required[Union[int, None]]
    id: Required[str]
    note: Required[str]
    owner: Required[str]
    position: Required[int]
    stageId: Required[str]
    status: Required[Literal['open', 'completed']]
    title: Required[str]
    updatedAt: Required[str]

PlanningTaskColor: TypeAlias = Literal['gray', 'blue', 'purple', 'green', 'yellow', 'orange', 'red', 'pink']

class PlanningTaskCreate(TypedDict, total=False):
    color: NotRequired["PlanningTaskColor"]
    featureNumber: NotRequired[Union[int, None]]
    note: NotRequired[str]
    owner: NotRequired[str]
    position: NotRequired[int]
    stageId: NotRequired[str]
    title: Required[str]

class PlanningTaskPatch(TypedDict, total=False):
    color: NotRequired["PlanningTaskColor"]
    featureNumber: NotRequired[Union[int, None]]
    note: NotRequired[str]
    owner: NotRequired[str]
    position: NotRequired[int]
    stageId: NotRequired[str]
    status: NotRequired[Literal['open', 'completed']]
    title: NotRequired[str]

class ProjectDestination(TypedDict, total=False):
    channelId: Required[str]
    connectionId: Required[str]

class ProjectIncident(TypedDict, total=False):
    acknowledgedAt: Required[Union[str, None]]
    acknowledgedBy: Required[Union[str, None]]
    component: Required[Union[str, None]]
    environment: Required[Union[str, None]]
    errorCode: Required[Union[str, None]]
    fingerprint: Required[str]
    firstSeenAt: Required[str]
    id: Required[str]
    lastSeenAt: Required[str]
    occurrenceCount: Required[int]
    resolvedAt: Required[Union[str, None]]
    resolvedBy: Required[Union[str, None]]
    sourceId: Required[str]
    sourceName: NotRequired[str]
    status: Required[Literal['open', 'acknowledged', 'resolved']]
    title: Required[str]
    updatedAt: NotRequired[str]

class ProjectIncidentOverview(TypedDict, total=False):
    errors: Required[list["ProjectIncidentOverviewErrors"]]
    metrics: Required[list["ProjectIncidentOverviewMetrics"]]
    project: Required[Union["ProjectIncidentOverviewProject", None]]
    sources: Required[list["ProjectIncidentOverviewSources"]]

class ProjectIncidentResponse(TypedDict, total=False):
    incident: Required["ProjectIncident"]

class ProjectIncidentUpdate(TypedDict, total=False):
    status: Required[Literal['open', 'acknowledged', 'resolved']]

class ProjectRoutingInput(TypedDict, total=False):
    enabled: Required[bool]
    repositories: Required[list[str]]
    routes: Required["ProjectRoutingInputRoutes"]

ProviderConnectionState: TypeAlias = Literal['ready', 'connecting', 'disconnected', 'degraded', 'unavailable']

RecordCollection: TypeAlias = Union[list["ApiRecord"], "PaginatedRecords", "ApiRecord"]

class RouteTest(TypedDict, total=False):
    channelId: NotRequired[str]
    route: Required[Literal['fallback', 'telemetry', 'planning', 'activity_posts', 'activity_release_notes']]

class RoutingPatch(TypedDict, total=False):
    routes: Required["RoutingPatchRoutes"]

class ServiceCapability(TypedDict, total=False):
    access: Required[Literal['member', 'admin']]
    blockers: Required[list[Literal['github', 'slack']]]
    description: Required[str]
    id: Required[str]
    name: Required[str]
    operations: Required[list["CapabilityOperation"]]
    requires: Required[list[Literal['github', 'slack']]]
    state: Required[Literal['ready', 'blocked', 'disabled']]

class ServiceCatalog(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    canConfigure: Required[bool]
    organization: Required["OrganizationReference"]
    services: Required[list["NoxService"]]

class ServiceConfig(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    config: Required[dict[str, Any]]
    configuration: Required["ServiceConfigConfiguration"]
    links: Required["ServiceLinks"]
    organization: Required["OrganizationReference"]
    revision: Required[str]
    schemaVersion: Required[Literal[1]]
    service: Required["ServiceId"]

ServiceConfigPatch: TypeAlias = Union["NoxHereConfigPatch", "PlanningConfigPatch", "ActivityConfigPatch", dict[str, Any]]

class ServiceConnectionRequirement(TypedDict, total=False):
    provider: Required[Literal['github', 'slack']]
    requirement: Required[Literal['required', 'optional']]
    state: Required["ProviderConnectionState"]

class ServiceDetail(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    canConfigure: Required[bool]
    organization: Required["OrganizationReference"]
    service: Required["NoxService"]

class ServiceHealth(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    checkedAt: Required[str]
    checks: Required[list["ServiceHealthChecks"]]
    links: Required["ServiceLinks"]
    organization: Required["OrganizationReference"]
    service: Required["ServiceId"]
    state: Required[Literal['healthy', 'degraded', 'blocked', 'disabled']]

ServiceId: TypeAlias = Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']

class ServiceLinks(TypedDict, total=False):
    health: Required[str]
    resources: Required[dict[str, str]]
    self: Required[str]
    setup: Required[str]

class ServiceSetup(TypedDict, total=False):
    blockers: Required[list["ServiceSetupBlockers"]]
    connections: Required[list["ServiceConnectionRequirement"]]
    sections: Required[list["ServiceSetupSections"]]
    state: Required[Literal['ready', 'needs_setup', 'disabled']]

class ServiceSetupDetail(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    blockers: Required[list[dict[str, Any]]]
    canConfigure: Required[bool]
    capabilities: Required[list["ServiceCapability"]]
    connections: Required[list["ServiceConnectionRequirement"]]
    links: Required["ServiceLinks"]
    organization: Required["OrganizationReference"]
    sections: Required[list["ServiceSetupDetailSections"]]
    service: Required["ServiceId"]
    state: Required[Literal['ready', 'needs_setup', 'disabled']]

class SetupPlan(TypedDict, total=False):
    apiVersion: Required[int]
    complete: Required[bool]
    steps: Required[dict[str, "SetupStep"]]

class SetupStep(TypedDict, total=False):
    action: NotRequired[Union[dict[str, Any], None]]
    automatable: Required[bool]
    required: Required[bool]
    state: Required[Literal['available', 'blocked', 'complete']]
    title: Required[str]

class SlackMessageDelivery(TypedDict, total=False):
    apiVersion: Required[Literal[1]]
    delivery: Required["SlackMessageDeliveryDelivery"]

class SlackMessagePayload(TypedDict, total=False):
    attachments: NotRequired[list[dict[str, Any]]]
    blocks: NotRequired[list[dict[str, Any]]]
    client_msg_id: NotRequired[str]
    icon_emoji: NotRequired[str]
    icon_url: NotRequired[str]
    link_names: NotRequired[bool]
    markdown_text: NotRequired[str]
    metadata: NotRequired["SlackMessagePayloadMetadata"]
    mrkdwn: NotRequired[bool]
    parse: NotRequired[Literal['none', 'full']]
    reply_broadcast: NotRequired[bool]
    text: NotRequired[str]
    thread_ts: NotRequired[str]
    unfurl_links: NotRequired[bool]
    unfurl_media: NotRequired[bool]
    username: NotRequired[str]

class SlackMessageRequest(TypedDict, total=False):
    channelId: Required[str]
    connectionId: Required[str]
    message: Required["SlackMessagePayload"]

class SlackProjectAssignment(TypedDict, total=False):
    displayName: NotRequired[Union[str, None]]
    projectId: NotRequired[Union[str, None]]

Spec: TypeAlias = ApiRecord

SpecAttachment: TypeAlias = ApiRecord

class SpecAttachmentList(TypedDict, total=False):
    attachments: Required[list["SpecAttachment"]]

class SpecInput(TypedDict, total=False):
    description: NotRequired[str]
    featureNumber: NotRequired[Union[int, None]]
    links: NotRequired[list["SpecInputLinks"]]
    title: Required[str]

class SpecList(TypedDict, total=False):
    specs: Required[list["Spec"]]

class SpecPatch(TypedDict, total=False):
    description: NotRequired[str]
    featureNumber: NotRequired[Union[int, None]]
    isPrimary: NotRequired[bool]
    links: NotRequired[list["SpecPatchLinks"]]
    title: NotRequired[str]

class StartConnectionBody(TypedDict, total=False):
    team: NotRequired[Union[str, None]]

class StatCard(TypedDict, total=False):
    breakdown: NotRequired["StatCardBreakdown"]
    change: Required[str]
    context: Required[str]
    direction: Required[Literal['up', 'down', 'same']]
    id: Required[str]
    name: Required[str]
    points: Required[list[float]]
    value: Required[str]

class StatCardBreakdown(TypedDict, total=False):
    actionLabel: Required[str]
    actionsPerParticipant: Required[float]
    activeUsers: Required[int]
    participatingUsers: Required[int]
    participationRate: Required[float]
    totalActions: Required[int]
    windowDays: Required[int]

class StatEvent(TypedDict, total=False):
    environment: Required[str]
    id: Required[str]
    name: Required[str]
    receivedAt: Required[str]
    status: Required[Literal['accepted', 'rejected']]
    subject: Required[str]
    type: Required[str]

StatEventList: TypeAlias = list["StatEvent"]

class StatsDashboard(TypedDict, total=False):
    dateLabel: Required[str]
    range: Required[str]
    reportStatus: Required[str]
    stats: Required[list["StatCard"]]

class TelemetryAction(TypedDict, total=False):
    key: Required[str]
    label: Required[str]
    slot: Required[int]

class TelemetryActions(TypedDict, total=False):
    actions: Required[list["TelemetryAction"]]
    projectId: Required[str]
    snippet: Required[str]
    windowDays: Required[Literal[7, 14, 30]]

class TelemetryActivityEvent(TypedDict, total=False):
    context: NotRequired["JsonValue"]
    environment: NotRequired[str]
    eventId: Required[str]
    idempotencyKey: NotRequired[str]
    metric: Required[str]
    occurredAt: NotRequired[str]
    type: Required[Literal['activity.occurred']]
    userId: Required[str]
    version: NotRequired[Literal[1]]

class TelemetryCardSelection(TypedDict, total=False):
    cards: Required[list["TelemetryCardSelectionCards"]]

class TelemetryCustomFeatureInput(TypedDict, total=False):
    failureMessage: Required[str]
    key: Required[str]
    label: Required[str]

class TelemetryCustomFeatureUpdate(TypedDict, total=False):
    enabled: Required[bool]
    failureMessage: Required[str]
    label: Required[str]

class TelemetryCustomMetricInput(TypedDict, total=False):
    key: Required[str]
    label: Required[str]

class TelemetryCustomMetricUpdate(TypedDict, total=False):
    enabled: Required[bool]
    label: Required[str]

class TelemetryError(TypedDict, total=False):
    data: NotRequired["TelemetryErrorData"]
    idempotencyKey: NotRequired[str]
    message: NotRequired[str]
    occurredAt: NotRequired[str]
    title: Required[str]
    type: Required[Literal['error.occurred']]
    url: NotRequired[str]
    version: NotRequired[Literal[1]]

class TelemetryFeatureResult(TypedDict, total=False):
    context: NotRequired["JsonValue"]
    durationMs: NotRequired[int]
    environment: NotRequired[str]
    error: NotRequired["JsonValue"]
    eventId: NotRequired[str]
    feature: Required[str]
    idempotencyKey: NotRequired[str]
    message: NotRequired[str]
    occurredAt: NotRequired[str]
    outcome: Required[Literal['success', 'rejected', 'failure']]
    reason: NotRequired[str]
    test: NotRequired[bool]
    type: Required[Literal['feature.result']]
    userId: NotRequired[str]
    version: NotRequired[Literal[1]]

class TelemetryGitHubIssueSettingsUpdate(TypedDict, total=False):
    commentOnRepeat: NotRequired[bool]
    enabled: Required[bool]
    environments: Required[list[Literal['production', 'staging', 'development', 'preview', 'test', 'local']]]
    projectId: Required[str]
    repeatIntervalMinutes: NotRequired[int]

class TelemetryIngestResponse(TypedDict, total=False):
    accepted: Required[Literal[True]]
    duplicate: NotRequired[bool]
    eventId: Required[str]
    notificationSuppressed: NotRequired[bool]
    period: NotRequired[str]
    queued: Required[bool]
    stored: Required[bool]

class TelemetryProjectMetricSelection(TypedDict, total=False):
    enabledMetricKeys: Required[list[Literal['users.new', 'users.total', 'users.active.daily', 'users.active.weekly', 'users.active.monthly', 'users.stickiness.dau_mau']]]

class TelemetrySourceInput(TypedDict, total=False):
    aggregateOnlySlack: NotRequired[bool]
    alertsEnabled: NotRequired[bool]
    allowedEvents: NotRequired[list[str]]
    allowedOrigins: NotRequired[list[str]]
    digestEnabled: Required[bool]
    digestTimeLocal: Required[str]
    enabled: Required[bool]
    environment: NotRequired[Literal['production', 'staging', 'development', 'preview', 'test', 'local']]
    healthEnabled: NotRequired[bool]
    healthUrl: NotRequired[Union[str, None]]
    name: Required[str]
    productionStats: NotRequired[bool]
    projectId: Required[Union[str, None]]
    reportTitle: NotRequired[Union[str, None]]
    retentionDays: NotRequired[int]
    slackChannelId: Required[Union[str, None]]
    slackConnectionId: Required[Union[str, None]]
    timezone: Required[str]

class TelemetryTrackedEvent(TypedDict, total=False):
    attributes: NotRequired[dict[str, Union[str, float, bool]]]
    context: NotRequired["JsonValue"]
    environment: NotRequired[str]
    eventId: Required[str]
    idempotencyKey: NotRequired[str]
    name: Required[str]
    occurredAt: NotRequired[str]
    type: Required[Literal['activity.tracked']]
    userId: NotRequired[str]
    value: NotRequired[float]
    version: NotRequired[Literal[1]]

class TelemetryUserEvent(TypedDict, total=False):
    occurredAt: NotRequired[str]
    type: Required[Literal['user.registered', 'user.active']]
    userId: Required[str]
    version: NotRequired[Literal[1]]

class UserAction(TypedDict, total=False):
    provider: Required[str]
    resume: Required[dict[str, Any]]
    status: Required[Literal['requires_user_action']]
    userAction: Required["UserActionUserAction"]

class AcknowledgeRepositoriesBody(TypedDict, total=False):
    repos: Required[list[str]]

class ArchiveProjectPath(TypedDict, total=False):
    projectId: Required[str]

class ArchiveSpecPath(TypedDict, total=False):
    specId: Required[int]

class AssignSlackConnectionProjectPath(TypedDict, total=False):
    connectionId: Required[str]

class BackfillProjectPullRequestsPath(TypedDict, total=False):
    projectId: Required[str]

class CloseFeaturePath(TypedDict, total=False):
    number: Required[int]

class ClosePullRequestBody(TypedDict, total=False):
    number: Required[int]
    repo: Required[str]

class CreateTelemetryCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]

class CreateTelemetryCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]

class CreateTelemetryKeyPath(TypedDict, total=False):
    sourceId: Required[str]

class CreateTelemetryKeyBody(TypedDict, total=False):
    kind: Required[Literal['publishable', 'secret']]
    name: Required[str]

class DeleteFeatureAttachmentPath(TypedDict, total=False):
    number: Required[int]
    attachmentId: Required[int]

class DeleteFeedbackSitePath(TypedDict, total=False):
    siteId: Required[str]

class DeletePlanningTaskPath(TypedDict, total=False):
    id: Required[str]

class DeleteSpecAttachmentPath(TypedDict, total=False):
    specId: Required[int]
    attachmentId: Required[int]

class DeleteTelemetryCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]
    featureKey: Required[str]

class DeleteTelemetryCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]
    metricKey: Required[str]

class DeleteTelemetrySourcePath(TypedDict, total=False):
    sourceId: Required[str]

class DisconnectConnectionPath(TypedDict, total=False):
    provider: Required[Literal['github', 'slack']]

class DownloadFeatureAttachmentPath(TypedDict, total=False):
    number: Required[int]
    attachmentId: Required[int]

class DownloadSpecAttachmentPath(TypedDict, total=False):
    specId: Required[int]
    attachmentId: Required[int]

class ExchangeLegacyNativeCredentialBody(TypedDict, total=False):
    access_token: Required[str]
    client: Required[Literal['activity-mac']]
    refresh_token: NotRequired[str]

class GetActivityQuery(TypedDict, total=False):
    mode: NotRequired[Literal['opened', 'merged', 'release-notes']]
    repo: NotRequired[str]
    actor: NotRequired[str]
    limit: NotRequired[int]
    before: NotRequired[str]

class GetActorPath(TypedDict, total=False):
    actorId: Required[str]

class GetEngineerActivityQuery(TypedDict, total=False):
    login: Required[str]
    month: NotRequired[str]

class GetFeedbackResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class GetFeedEventPath(TypedDict, total=False):
    id: Required[str]

class GetIssuePath(TypedDict, total=False):
    repo: Required[str]
    number: Required[int]

class GetNoxServicePath(TypedDict, total=False):
    service: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]

class GetNoxServiceConfigPath(TypedDict, total=False):
    service: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]

class GetNoxServiceHealthPath(TypedDict, total=False):
    service: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]

class GetNoxServiceSetupPath(TypedDict, total=False):
    service: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]

class GetProjectActivityPath(TypedDict, total=False):
    projectId: Required[str]

class GetProjectFeedbackPath(TypedDict, total=False):
    projectId: Required[str]

class GetProjectIncidentPath(TypedDict, total=False):
    projectId: Required[str]
    incidentId: Required[str]

class GetProjectIncidentsPath(TypedDict, total=False):
    projectId: Required[str]

class GetProjectIssuesPath(TypedDict, total=False):
    projectId: Required[str]

class GetPublicFeedbackConfigPath(TypedDict, total=False):
    siteId: Required[str]

class GetPublicFeedbackMembersPath(TypedDict, total=False):
    siteId: Required[str]

class GetPublicFeedbackMembersResponse(TypedDict, total=False):
    members: Required[list["GetPublicFeedbackMembersResponseMembers"]]

class GetPullRequestPath(TypedDict, total=False):
    repo: Required[str]
    number: Required[int]

class GetSpecPath(TypedDict, total=False):
    specId: Required[int]

class GetTelemetryDailyHealthQuery(TypedDict, total=False):
    sourceId: Required[str]

class GetTelemetryProjectActionsPath(TypedDict, total=False):
    projectId: Required[str]

class GetTelemetryProjectAlertRulesPath(TypedDict, total=False):
    projectId: Required[str]

class GetTelemetryProjectAlertsPath(TypedDict, total=False):
    projectId: Required[str]

class GetTelemetryProjectDashboardPath(TypedDict, total=False):
    projectId: Required[str]

class GetTelemetryProjectMetricsPath(TypedDict, total=False):
    projectId: Required[str]

class GetTelemetryProjectStatEventsPath(TypedDict, total=False):
    projectId: Required[str]

class GetWorkspaceConfigPath(TypedDict, total=False):
    key: Required[str]

class ListFeatureAttachmentsPath(TypedDict, total=False):
    number: Required[int]

class ListFeaturesQuery(TypedDict, total=False):
    state: NotRequired[str]

class ListIssuesQuery(TypedDict, total=False):
    state: NotRequired[str]
    repo: NotRequired[str]
    page: NotRequired[int]
    page_size: NotRequired[int]
    sort: NotRequired[str]
    sort_dir: NotRequired[Literal['asc', 'desc']]

class ListPlanningTasksQuery(TypedDict, total=False):
    owner: NotRequired[str]
    status: NotRequired[Literal['open', 'completed', 'all']]
    featureNumber: NotRequired[Union[int, Literal['general']]]

class ListPullRequestsQuery(TypedDict, total=False):
    state: NotRequired[str]
    author: NotRequired[str]
    repo: NotRequired[str]
    page: NotRequired[int]
    page_size: NotRequired[int]

class ListRepositoriesQuery(TypedDict, total=False):
    include: NotRequired[Literal['all']]

class ListSpecAttachmentsPath(TypedDict, total=False):
    specId: Required[int]

class ListSpecsQuery(TypedDict, total=False):
    featureNumber: NotRequired[str]
    include: NotRequired[Literal['all']]

class ListTelemetryCardsPath(TypedDict, total=False):
    sourceId: Required[str]

class ListTelemetryCustomMetricsPath(TypedDict, total=False):
    sourceId: Required[str]

class ListTelemetryEventsQuery(TypedDict, total=False):
    sourceId: NotRequired[str]
    limit: NotRequired[int]

class ListTelemetryFeaturesPath(TypedDict, total=False):
    sourceId: Required[str]

class ListTelemetryKeysPath(TypedDict, total=False):
    sourceId: Required[str]

class PatchNoxServiceConfigPath(TypedDict, total=False):
    service: Required[Literal['noxhere', 'planning', 'activity', 'feedback', 'telemetry']]

class PollNativeDeviceAuthorizationBody(TypedDict, total=False):
    client: Required[Literal['activity-mac']]
    device_code: Required[str]

class PreviewFeedbackResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class PreviewFeedbackResolutionTemplateBody(TypedDict, total=False):
    template: Required["FeedbackResolutionTemplate"]

class PutAiSettingsBody(TypedDict, total=False):
    mode: Required[Literal['disabled', 'managed']]

class PutWorkspaceConfigPath(TypedDict, total=False):
    key: Required[str]

class RefreshNativeSessionBody(TypedDict, total=False):
    refresh_token: Required[str]

class ReopenResolvedFeedbackReportPath(TypedDict, total=False):
    token: Required[str]

class RestoreProjectPath(TypedDict, total=False):
    projectId: Required[str]

class RestoreSpecPath(TypedDict, total=False):
    specId: Required[int]

class RetrieveProjectPath(TypedDict, total=False):
    projectId: Required[str]

class RetryFeedbackDeliveriesPath(TypedDict, total=False):
    siteId: Required[str]

class RevokeApiTokenPath(TypedDict, total=False):
    id: Required[str]

class RevokeGuestGrantPath(TypedDict, total=False):
    grantId: Required[str]

class RevokeGuestInvitationPath(TypedDict, total=False):
    inviteId: Required[str]

class RevokeNativeSessionBody(TypedDict, total=False):
    refresh_token: Required[str]

class RevokeTelemetryKeyPath(TypedDict, total=False):
    sourceId: Required[str]
    keyId: Required[str]

class RotateApiTokenPath(TypedDict, total=False):
    id: Required[str]

class RotateTelemetryKeyPath(TypedDict, total=False):
    sourceId: Required[str]
    keyId: Required[str]

SearchWorkspaceQuery = TypedDict('SearchWorkspaceQuery', {'q': NotRequired[str], 'tools': NotRequired[str], 'kinds': NotRequired[str], 'repos': NotRequired[str], 'assignees': NotRequired[str], 'statuses': NotRequired[str], 'tags': NotRequired[str], 'exclude': NotRequired[str], 'from': NotRequired[str], 'to': NotRequired[str], 'limit': NotRequired[int]}, total=False)

class StartConnectionPath(TypedDict, total=False):
    provider: Required[Literal['github', 'slack']]

class StartNativeDeviceAuthorizationBody(TypedDict, total=False):
    client: Required[Literal['activity-mac']]

class TestFeedbackResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class TestFeedbackResolutionTemplateBody(TypedDict, total=False):
    recipient: Required[str]
    template: Required["FeedbackResolutionTemplate"]

class TestTelemetrySourcePath(TypedDict, total=False):
    sourceId: Required[str]

class UpdateActorPath(TypedDict, total=False):
    actorId: Required[str]

class UpdateFeaturePath(TypedDict, total=False):
    number: Required[int]

class UpdateFeedbackReportPath(TypedDict, total=False):
    reportId: Required[str]

class UpdateFeedbackReportBody(TypedDict, total=False):
    notify: NotRequired[bool]
    retryNotification: NotRequired[bool]
    status: Required[Literal['open', 'investigating', 'resolved']]
    summary: NotRequired[str]

class UpdateFeedbackResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class UpdateFeedbackResolutionTemplateBody(TypedDict, total=False):
    template: Required[Union["FeedbackResolutionTemplate", None]]

class UpdateFeedbackSitePath(TypedDict, total=False):
    siteId: Required[str]

class UpdatePlanningTaskPath(TypedDict, total=False):
    id: Required[str]

class UpdateProjectIncidentPath(TypedDict, total=False):
    projectId: Required[str]
    incidentId: Required[str]

class UpdateProjectRoutingPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateSpecPath(TypedDict, total=False):
    specId: Required[int]

class UpdateTelemetryCardsPath(TypedDict, total=False):
    sourceId: Required[str]

class UpdateTelemetryCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]
    featureKey: Required[str]

class UpdateTelemetryCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]
    metricKey: Required[str]

class UpdateTelemetryErrorStatusPath(TypedDict, total=False):
    sourceId: Required[str]
    fingerprint: Required[str]

class UpdateTelemetryErrorStatusBody(TypedDict, total=False):
    status: Required[Literal['open', 'acknowledged', 'resolved']]

class UpdateTelemetryProjectActionsPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateTelemetryProjectMetricsPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateTelemetrySourcePath(TypedDict, total=False):
    sourceId: Required[str]

class UploadFeatureAttachmentPath(TypedDict, total=False):
    number: Required[int]

class UploadSpecAttachmentPath(TypedDict, total=False):
    specId: Required[int]

class AiSettingsManaged(TypedDict, total=False):
    available: Required[bool]
    model: Required[str]
    provider: Required[str]
    services: Required["AiSettingsManagedServices"]

class ApiV1ErrorError(TypedDict, total=False):
    code: Required[str]
    details: NotRequired[Any]
    message: Required[str]

class DeveloperFeedbackCreateClient(TypedDict, total=False):
    name: Required[str]
    version: NotRequired[str]

class DeveloperFeedbackReceiptFeedback(TypedDict, total=False):
    createdAt: Required[str]
    duplicate: Required[bool]
    id: Required[str]
    status: Required[Literal['received']]

class FeedbackErrorBatchErrors(TypedDict, total=False):
    message: Required[str]
    title: NotRequired[str]
    url: NotRequired[str]

class FeedbackResolutionTemplateAppearance(TypedDict, total=False):
    accentColor: Required[str]
    backgroundColor: Required[str]
    fontPreset: Required[Literal['system', 'playnist', 'humanist', 'editorial', 'mono']]
    mutedColor: Required[str]
    surfaceColor: Required[str]
    textColor: Required[str]

class NoxHereConfigPatchEnabledServices(TypedDict, total=False):
    activity: NotRequired[bool]
    feedback: NotRequired[bool]
    planning: NotRequired[bool]
    telemetry: NotRequired[bool]

class NoxServiceLinks(TypedDict, total=False):
    config: Required[str]
    health: Required[str]
    self: Required[str]
    setup: Required[str]

class PlanningAssistResponseDraft(TypedDict, total=False):
    featureNumber: Required[Union[int, None]]
    title: Required[str]

class PlanningConfigPatchWorkflow(TypedDict, total=False):
    stages: Required[list["PlanningConfigPatchWorkflowStages"]]

class ProjectIncidentOverviewErrors(TypedDict, total=False):
    environment: Required[str]
    fingerprint: Required[str]
    id: Required[str]
    last_seen_at: Required[str]
    occurrence_count: Required[int]
    source_id: Required[str]
    source_name: Required[str]
    title: Required[str]

class ProjectIncidentOverviewMetrics(TypedDict, total=False):
    metric_key: Required[str]
    origin: Required[str]
    period: Required[str]
    source_id: Required[str]
    source_name: Required[str]
    value: Required[float]

class ProjectIncidentOverviewProject(TypedDict, total=False):
    id: Required[str]
    name: Required[str]

class ProjectIncidentOverviewSources(TypedDict, total=False):
    environment: Required[str]
    id: Required[str]
    last_activity_at: NotRequired[Union[str, None]]
    last_registration_at: NotRequired[Union[str, None]]
    name: Required[str]

class ProjectRoutingInputRoutes(TypedDict, total=False):
    activityPosts: Required["ProjectDestination"]
    activityReleaseNotes: Required["ProjectDestination"]
    telemetry: Required["ProjectDestination"]
    telemetryAlerts: Required["ProjectDestination"]

class RoutingPatchRoutes(TypedDict, total=False):
    activity_posts: NotRequired[Union[str, None]]
    activity_release_notes: NotRequired[Union[str, None]]
    fallback: NotRequired[Union[str, None]]
    planning: NotRequired[Union[str, None]]
    telemetry: NotRequired[Union[str, None]]

class ServiceConfigConfiguration(TypedDict, total=False):
    mode: Required[Literal['service', 'resource']]
    writable: Required[bool]
    writableFields: Required[list[str]]

class ServiceHealthChecks(TypedDict, total=False):
    detail: NotRequired[str]
    id: Required[str]
    required: Required[bool]
    state: Required[Literal['pass', 'warn', 'fail']]

class ServiceSetupBlockers(TypedDict, total=False):
    provider: Required[Literal['github', 'slack']]
    state: Required["ProviderConnectionState"]
    type: Required[Literal['connection']]

class ServiceSetupSections(TypedDict, total=False):
    capabilityIds: Required[list[str]]
    id: Required[str]
    name: Required[str]

class ServiceSetupDetailSections(TypedDict, total=False):
    capabilityIds: Required[list[str]]
    id: Required[str]
    name: Required[str]
    state: Required[Literal['ready', 'blocked', 'disabled']]

class SlackMessageDeliveryDelivery(TypedDict, total=False):
    channelId: Required[str]
    connectionId: Required[str]
    messageTs: Required[str]
    sentAt: Required[str]
    status: Required[Literal['sent']]

class SlackMessagePayloadMetadata(TypedDict, total=False):
    event_payload: Required[dict[str, Any]]
    event_type: Required[str]

class SpecInputLinks(TypedDict, total=False):
    label: NotRequired[str]
    url: Required[str]

class SpecPatchLinks(TypedDict, total=False):
    label: NotRequired[str]
    url: Required[str]

class TelemetryCardSelectionCards(TypedDict, total=False):
    cumulativeLabel: NotRequired[Union[str, None]]
    dailyLabel: NotRequired[Union[str, None]]
    enabled: NotRequired[bool]
    metricKey: Required[str]
    perActiveEnabled: NotRequired[bool]

class TelemetryErrorData(TypedDict, total=False):
    affectedUser: NotRequired[str]
    component: NotRequired[str]
    environment: NotRequired[str]
    errorCode: NotRequired[str]
    fatal: NotRequired[bool]
    fingerprint: NotRequired[str]
    unhandled: NotRequired[bool]

class UserActionUserAction(TypedDict, total=False):
    instructions: Required[str]
    type: Required[Literal['open_url']]
    url: Required[str]

class GetPublicFeedbackMembersResponseMembers(TypedDict, total=False):
    avatarUrl: NotRequired[Union[str, None]]
    login: Required[str]

class AiSettingsManagedServices(TypedDict, total=False):
    activity: Required["ManagedAiServiceStatus"]
    noxhere: Required["ManagedAiServiceStatus"]

class PlanningConfigPatchWorkflowStages(TypedDict, total=False):
    color: Required[str]
    id: Required[str]
    label: Required[str]
