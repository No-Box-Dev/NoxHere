# Generated from packages/sdk-contract/public-api.json. Do not edit by hand.
from typing import Any, Literal, TypeAlias, Union
from typing_extensions import NotRequired, Required, TypedDict

JsonPrimitive: TypeAlias = None | bool | int | float | str

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

class NoxConnectConfigPatch(TypedDict, total=False):
    enabledServices: NotRequired["NoxConnectConfigPatchEnabledServices"]
    newRepositoryPolicy: NotRequired[Literal['include', 'exclude']]

class NoxCueActivityEvent(TypedDict, total=False):
    context: NotRequired["JsonValue"]
    environment: NotRequired[str]
    eventId: Required[str]
    idempotencyKey: NotRequired[str]
    metric: Required[str]
    occurredAt: NotRequired[str]
    type: Required[Literal['activity.occurred']]
    userId: Required[str]
    version: NotRequired[Literal[1]]

class NoxCueCustomFeatureInput(TypedDict, total=False):
    failureMessage: Required[str]
    key: Required[str]
    label: Required[str]

class NoxCueCustomFeatureUpdate(TypedDict, total=False):
    enabled: Required[bool]
    failureMessage: Required[str]
    label: Required[str]

class NoxCueCustomMetricInput(TypedDict, total=False):
    key: Required[str]
    label: Required[str]

class NoxCueCustomMetricUpdate(TypedDict, total=False):
    enabled: Required[bool]
    label: Required[str]

class NoxCueError(TypedDict, total=False):
    data: NotRequired["NoxCueErrorData"]
    idempotencyKey: NotRequired[str]
    message: NotRequired[str]
    occurredAt: NotRequired[str]
    title: Required[str]
    type: Required[Literal['error.occurred']]
    url: NotRequired[str]
    version: NotRequired[Literal[1]]

class NoxCueFeatureResult(TypedDict, total=False):
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

class NoxCueGitHubIssueSettingsUpdate(TypedDict, total=False):
    commentOnRepeat: NotRequired[bool]
    enabled: Required[bool]
    environments: Required[list[Literal['production', 'staging', 'development', 'preview', 'test', 'local']]]
    projectId: Required[str]
    repeatIntervalMinutes: NotRequired[int]

class NoxCueIngestResponse(TypedDict, total=False):
    accepted: Required[Literal[True]]
    duplicate: NotRequired[bool]
    eventId: Required[str]
    notificationSuppressed: NotRequired[bool]
    period: NotRequired[str]
    queued: Required[bool]
    stored: Required[bool]

class NoxCueProjectMetricSelection(TypedDict, total=False):
    enabledMetricKeys: Required[list[Literal['users.new', 'users.total', 'users.active.daily', 'users.active.weekly', 'users.active.monthly', 'users.stickiness.dau_mau']]]

class NoxCueSourceInput(TypedDict, total=False):
    allowedOrigins: NotRequired[list[str]]
    digestEnabled: Required[bool]
    digestTimeLocal: Required[str]
    enabled: Required[bool]
    healthEnabled: NotRequired[bool]
    healthUrl: NotRequired[Union[str, None]]
    name: Required[str]
    projectId: Required[Union[str, None]]
    slackChannelId: Required[Union[str, None]]
    slackConnectionId: Required[Union[str, None]]
    timezone: Required[str]

class NoxCueUserEvent(TypedDict, total=False):
    occurredAt: NotRequired[str]
    type: Required[Literal['user.registered', 'user.active']]
    userId: Required[str]
    version: NotRequired[Literal[1]]

class NoxFeedConfigPatch(TypedDict, total=False):
    releaseNotesPrompt: NotRequired[Union[str, None]]

class NoxService(TypedDict, total=False):
    capabilities: Required[list["ServiceCapability"]]
    description: Required[str]
    enabled: Required[bool]
    focus: Required[str]
    id: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]
    kind: Required[Literal['foundation', 'product']]
    links: Required["NoxServiceLinks"]
    name: Required[str]
    setup: Required["ServiceSetup"]

class NoxSpotBlock(TypedDict, total=False):
    environments: NotRequired[list[str]]
    id: Required[str]
    label: NotRequired[Union[str, None]]
    options: NotRequired[list[str]]
    required: NotRequired[bool]
    type: Required[Literal['title', 'description', 'reporter', 'contact_email', 'custom_text', 'custom_textarea', 'custom_select', 'element_picker', 'metadata', 'console_logs']]

class NoxSpotEnvironment(TypedDict, total=False):
    buttonColor: NotRequired[Union[str, None]]
    buttonText: NotRequired[Union[str, None]]
    enabled: NotRequired[bool]
    name: Required[str]
    url: Required[str]
    widgetMode: NotRequired[Literal['development', 'release', None]]

class NoxSpotErrorBatch(TypedDict, total=False):
    errors: Required[list["NoxSpotErrorBatchErrors"]]
    siteId: Required[str]

class NoxSpotReport(TypedDict, total=False):
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

class NoxSpotResolutionTemplate(TypedDict, total=False):
    acknowledgement: Required[str]
    appearance: Required["NoxSpotResolutionTemplateAppearance"]
    buttonLabel: Required[str]
    closing: Required[str]
    reopenText: Required[str]
    replyTo: Required[Union[str, None]]
    senderName: Required[str]
    subject: Required[str]
    tone: Required[Literal['default', 'warm', 'formal', 'concise']]

class NoxSpotResolutionTemplateDocument(TypedDict, total=False):
    defaults: Required["NoxSpotResolutionTemplate"]
    revision: Required[str]
    template: Required["NoxSpotResolutionTemplate"]
    usingDefault: Required[bool]

class NoxSpotSiteCreate(TypedDict, total=False):
    autoErrorLogging: NotRequired[bool]
    buttonColor: NotRequired[str]
    buttonText: NotRequired[str]
    name: Required[str]
    projectId: Required[str]
    widgetMode: NotRequired[Literal['development', 'release']]

class NoxSpotSitePatch(TypedDict, total=False):
    autoErrorLogging: NotRequired[bool]
    blocks: NotRequired[list["NoxSpotBlock"]]
    buttonColor: NotRequired[str]
    buttonText: NotRequired[str]
    environments: NotRequired[list["NoxSpotEnvironment"]]
    slackChannelId: NotRequired[Union[str, None]]
    slackConnectionId: NotRequired[Union[str, None]]
    widgetMode: NotRequired[Literal['development', 'release']]

class NoxTicketConfigPatch(TypedDict, total=False):
    featureRepository: NotRequired[Union[str, None]]
    workflow: NotRequired["NoxTicketConfigPatchWorkflow"]

class OrganizationReference(TypedDict, total=False):
    login: Required[str]

class PaginatedRecords(TypedDict, total=False):
    data: Required[list["ApiRecord"]]
    page: Required[int]
    pageSize: Required[int]
    totalCount: Required[int]

class ProjectDestination(TypedDict, total=False):
    channelId: Required[str]
    connectionId: Required[str]

class ProjectRoutingInput(TypedDict, total=False):
    enabled: Required[bool]
    repositories: Required[list[str]]
    routes: Required["ProjectRoutingInputRoutes"]

ProviderConnectionState: TypeAlias = Literal['ready', 'connecting', 'disconnected', 'degraded', 'unavailable']

RecordCollection: TypeAlias = Union[list["ApiRecord"], "PaginatedRecords", "ApiRecord"]

class RouteTest(TypedDict, total=False):
    channelId: NotRequired[str]
    route: Required[Literal['fallback', 'noxcue', 'noxticket', 'noxfeed_posts', 'noxfeed_release_notes']]

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

ServiceConfigPatch: TypeAlias = Union["NoxConnectConfigPatch", "NoxTicketConfigPatch", "NoxFeedConfigPatch", dict[str, Any]]

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

ServiceId: TypeAlias = Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']

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

class SlackProjectAssignment(TypedDict, total=False):
    projectId: Required[Union[str, None]]

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

class CreateNoxCueCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]

class CreateNoxCueCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]

class CreateNoxCueKeyPath(TypedDict, total=False):
    sourceId: Required[str]

class CreateNoxCueKeyBody(TypedDict, total=False):
    kind: Required[Literal['publishable', 'secret']]
    name: Required[str]

class DeleteFeatureAttachmentPath(TypedDict, total=False):
    number: Required[int]
    attachmentId: Required[int]

class DeleteNoxCueCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]
    featureKey: Required[str]

class DeleteNoxCueCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]
    metricKey: Required[str]

class DeleteNoxCueSourcePath(TypedDict, total=False):
    sourceId: Required[str]

class DeleteNoxSpotSitePath(TypedDict, total=False):
    siteId: Required[str]

class DeleteSpecAttachmentPath(TypedDict, total=False):
    specId: Required[int]
    attachmentId: Required[int]

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
    client: Required[Literal['noxfeed-mac']]
    refresh_token: NotRequired[str]

class GetActorPath(TypedDict, total=False):
    actorId: Required[str]

class GetCueProjectActionsPath(TypedDict, total=False):
    projectId: Required[str]

class GetCueProjectAlertRulesPath(TypedDict, total=False):
    projectId: Required[str]

class GetCueProjectAlertsPath(TypedDict, total=False):
    projectId: Required[str]

class GetCueProjectDashboardPath(TypedDict, total=False):
    projectId: Required[str]

class GetCueProjectStatEventsPath(TypedDict, total=False):
    projectId: Required[str]

class GetEngineerActivityQuery(TypedDict, total=False):
    login: Required[str]
    month: NotRequired[str]

class GetFeedEventPath(TypedDict, total=False):
    id: Required[str]

class GetIssuePath(TypedDict, total=False):
    repo: Required[str]
    number: Required[int]

class GetNoxCueDailyHealthQuery(TypedDict, total=False):
    sourceId: Required[str]

class GetNoxCueProjectMetricsPath(TypedDict, total=False):
    projectId: Required[str]

class GetNoxFeedQuery(TypedDict, total=False):
    mode: NotRequired[Literal['opened', 'merged', 'release-notes']]
    repo: NotRequired[str]
    actor: NotRequired[str]
    limit: NotRequired[int]
    before: NotRequired[str]

class GetNoxServicePath(TypedDict, total=False):
    service: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]

class GetNoxServiceConfigPath(TypedDict, total=False):
    service: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]

class GetNoxServiceHealthPath(TypedDict, total=False):
    service: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]

class GetNoxServiceSetupPath(TypedDict, total=False):
    service: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]

class GetNoxSpotResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

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

class GetPublicNoxSpotConfigPath(TypedDict, total=False):
    siteId: Required[str]

class GetPullRequestPath(TypedDict, total=False):
    repo: Required[str]
    number: Required[int]

class GetSpecPath(TypedDict, total=False):
    specId: Required[int]

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

class ListNoxCueCustomMetricsPath(TypedDict, total=False):
    sourceId: Required[str]

class ListNoxCueEventsQuery(TypedDict, total=False):
    sourceId: NotRequired[str]
    limit: NotRequired[int]

class ListNoxCueFeaturesPath(TypedDict, total=False):
    sourceId: Required[str]

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

class PatchNoxServiceConfigPath(TypedDict, total=False):
    service: Required[Literal['noxconnect', 'noxticket', 'noxfeed', 'noxspot', 'noxcue']]

class PollNativeDeviceAuthorizationBody(TypedDict, total=False):
    client: Required[Literal['noxfeed-mac']]
    device_code: Required[str]

class PreviewNoxSpotResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class PreviewNoxSpotResolutionTemplateBody(TypedDict, total=False):
    template: Required["NoxSpotResolutionTemplate"]

class PutAiSettingsBody(TypedDict, total=False):
    mode: Required[Literal['disabled', 'managed']]

class PutWorkspaceConfigPath(TypedDict, total=False):
    key: Required[str]

class RefreshNativeSessionBody(TypedDict, total=False):
    refresh_token: Required[str]

class ReopenResolvedNoxSpotReportPath(TypedDict, total=False):
    token: Required[str]

class RestoreProjectPath(TypedDict, total=False):
    projectId: Required[str]

class RestoreSpecPath(TypedDict, total=False):
    specId: Required[int]

class RetrieveProjectPath(TypedDict, total=False):
    projectId: Required[str]

class RetryNoxSpotDeliveriesPath(TypedDict, total=False):
    siteId: Required[str]

class RevokeApiTokenPath(TypedDict, total=False):
    id: Required[str]

class RevokeGuestGrantPath(TypedDict, total=False):
    grantId: Required[str]

class RevokeGuestInvitationPath(TypedDict, total=False):
    inviteId: Required[str]

class RevokeNativeSessionBody(TypedDict, total=False):
    refresh_token: Required[str]

class RevokeNoxCueKeyPath(TypedDict, total=False):
    sourceId: Required[str]
    keyId: Required[str]

class RotateApiTokenPath(TypedDict, total=False):
    id: Required[str]

SearchWorkspaceQuery = TypedDict('SearchWorkspaceQuery', {'q': NotRequired[str], 'tools': NotRequired[str], 'kinds': NotRequired[str], 'repos': NotRequired[str], 'assignees': NotRequired[str], 'statuses': NotRequired[str], 'tags': NotRequired[str], 'exclude': NotRequired[str], 'from': NotRequired[str], 'to': NotRequired[str], 'limit': NotRequired[int]}, total=False)

class StartConnectionPath(TypedDict, total=False):
    provider: Required[Literal['github', 'slack']]

class StartNativeDeviceAuthorizationBody(TypedDict, total=False):
    client: Required[Literal['noxfeed-mac']]

class TestNoxCueSourcePath(TypedDict, total=False):
    sourceId: Required[str]

class TestNoxSpotResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class TestNoxSpotResolutionTemplateBody(TypedDict, total=False):
    recipient: Required[str]
    template: Required["NoxSpotResolutionTemplate"]

class UpdateActorPath(TypedDict, total=False):
    actorId: Required[str]

class UpdateCueProjectActionsPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateFeaturePath(TypedDict, total=False):
    number: Required[int]

class UpdateNoxCueCustomFeaturePath(TypedDict, total=False):
    sourceId: Required[str]
    featureKey: Required[str]

class UpdateNoxCueCustomMetricPath(TypedDict, total=False):
    sourceId: Required[str]
    metricKey: Required[str]

class UpdateNoxCueErrorStatusPath(TypedDict, total=False):
    sourceId: Required[str]
    fingerprint: Required[str]

class UpdateNoxCueErrorStatusBody(TypedDict, total=False):
    status: Required[Literal['open', 'acknowledged', 'resolved']]

class UpdateNoxCueProjectMetricsPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateNoxCueSourcePath(TypedDict, total=False):
    sourceId: Required[str]

class UpdateNoxSpotReportPath(TypedDict, total=False):
    reportId: Required[str]

class UpdateNoxSpotReportBody(TypedDict, total=False):
    notify: NotRequired[bool]
    retryNotification: NotRequired[bool]
    status: Required[Literal['open', 'investigating', 'resolved']]
    summary: NotRequired[str]

class UpdateNoxSpotResolutionTemplatePath(TypedDict, total=False):
    siteId: Required[str]

class UpdateNoxSpotResolutionTemplateBody(TypedDict, total=False):
    template: Required[Union["NoxSpotResolutionTemplate", None]]

class UpdateNoxSpotSitePath(TypedDict, total=False):
    siteId: Required[str]

class UpdateProjectIncidentPath(TypedDict, total=False):
    projectId: Required[str]
    incidentId: Required[str]

class UpdateProjectRoutingPath(TypedDict, total=False):
    projectId: Required[str]

class UpdateSpecPath(TypedDict, total=False):
    specId: Required[int]

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

class NoxConnectConfigPatchEnabledServices(TypedDict, total=False):
    noxcue: NotRequired[bool]
    noxfeed: NotRequired[bool]
    noxspot: NotRequired[bool]
    noxticket: NotRequired[bool]

class NoxCueErrorData(TypedDict, total=False):
    affectedUser: NotRequired[str]
    component: NotRequired[str]
    environment: NotRequired[str]
    errorCode: NotRequired[str]
    fatal: NotRequired[bool]
    fingerprint: NotRequired[str]
    unhandled: NotRequired[bool]

class NoxServiceLinks(TypedDict, total=False):
    config: Required[str]
    health: Required[str]
    self: Required[str]
    setup: Required[str]

class NoxSpotErrorBatchErrors(TypedDict, total=False):
    message: Required[str]
    title: NotRequired[str]
    url: NotRequired[str]

class NoxSpotResolutionTemplateAppearance(TypedDict, total=False):
    accentColor: Required[str]
    backgroundColor: Required[str]
    fontPreset: Required[Literal['system', 'playnist', 'humanist', 'editorial', 'mono']]
    mutedColor: Required[str]
    surfaceColor: Required[str]
    textColor: Required[str]

class NoxTicketConfigPatchWorkflow(TypedDict, total=False):
    stages: Required[list["NoxTicketConfigPatchWorkflowStages"]]

class ProjectRoutingInputRoutes(TypedDict, total=False):
    noxCue: Required["ProjectDestination"]
    noxCueAlerts: Required["ProjectDestination"]
    noxfeedPosts: Required["ProjectDestination"]
    noxfeedReleaseNotes: Required["ProjectDestination"]

class RoutingPatchRoutes(TypedDict, total=False):
    fallback: NotRequired[Union[str, None]]
    noxcue: NotRequired[Union[str, None]]
    noxfeed_posts: NotRequired[Union[str, None]]
    noxfeed_release_notes: NotRequired[Union[str, None]]
    noxticket: NotRequired[Union[str, None]]

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

class SpecInputLinks(TypedDict, total=False):
    label: NotRequired[str]
    url: Required[str]

class SpecPatchLinks(TypedDict, total=False):
    label: NotRequired[str]
    url: Required[str]

class UserActionUserAction(TypedDict, total=False):
    instructions: Required[str]
    type: Required[Literal['open_url']]
    url: Required[str]

class AiSettingsManagedServices(TypedDict, total=False):
    noxconnect: Required["ManagedAiServiceStatus"]
    noxfeed: Required["ManagedAiServiceStatus"]

class NoxTicketConfigPatchWorkflowStages(TypedDict, total=False):
    color: Required[str]
    id: Required[str]
    label: Required[str]
