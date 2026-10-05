// Generated from public/openapi.json. Do not edit by hand.
export const operationDefinitions = [
  {
    "id": "acknowledgeRepositories",
    "method": "POST",
    "path": "/api/v1/repos/acknowledge",
    "namespace": "workspace"
  },
  {
    "id": "archiveProject",
    "method": "POST",
    "path": "/api/v1/projects/{projectId}/archive",
    "namespace": "workspace"
  },
  {
    "id": "archiveSpec",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning"
  },
  {
    "id": "assignIssue",
    "method": "POST",
    "path": "/api/v1/assign",
    "namespace": "planning"
  },
  {
    "id": "assignSlackConnectionProject",
    "method": "PATCH",
    "path": "/api/v1/slack/connections/{connectionId}",
    "namespace": "workspace"
  },
  {
    "id": "backfillProjectPullRequests",
    "method": "POST",
    "path": "/api/v1/projects/{projectId}/backfill-prs",
    "namespace": "workspace"
  },
  {
    "id": "closeFeature",
    "method": "DELETE",
    "path": "/api/v1/features/{number}",
    "namespace": "planning"
  },
  {
    "id": "closePullRequest",
    "method": "POST",
    "path": "/api/v1/prs/close",
    "namespace": "activity"
  },
  {
    "id": "createApiToken",
    "method": "POST",
    "path": "/api/v1/api-tokens",
    "namespace": "workspace"
  },
  {
    "id": "createFeature",
    "method": "POST",
    "path": "/api/v1/features",
    "namespace": "planning"
  },
  {
    "id": "createGuestInvitation",
    "method": "POST",
    "path": "/api/v1/guests/invites",
    "namespace": "workspace"
  },
  {
    "id": "createNoxCueCustomFeature",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/features",
    "namespace": "incidents"
  },
  {
    "id": "createNoxCueCustomMetric",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics",
    "namespace": "incidents"
  },
  {
    "id": "createNoxCueKey",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/keys",
    "namespace": "incidents"
  },
  {
    "id": "createNoxCueSource",
    "method": "POST",
    "path": "/api/v1/cues/sources",
    "namespace": "incidents"
  },
  {
    "id": "createNoxSpotSite",
    "method": "POST",
    "path": "/api/v1/spots/sites",
    "namespace": "feedback"
  },
  {
    "id": "createProject",
    "method": "POST",
    "path": "/api/v1/projects",
    "namespace": "workspace"
  },
  {
    "id": "createSpec",
    "method": "POST",
    "path": "/api/v1/specs",
    "namespace": "planning"
  },
  {
    "id": "deleteFeatureAttachment",
    "method": "DELETE",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning"
  },
  {
    "id": "deleteNoxCueCustomFeature",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents"
  },
  {
    "id": "deleteNoxCueCustomMetric",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "incidents"
  },
  {
    "id": "deleteNoxCueSource",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}",
    "namespace": "incidents"
  },
  {
    "id": "deleteNoxSpotSite",
    "method": "DELETE",
    "path": "/api/v1/spots/sites/{siteId}",
    "namespace": "feedback"
  },
  {
    "id": "deleteSpecAttachment",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning"
  },
  {
    "id": "disconnectConnection",
    "method": "POST",
    "path": "/api/v1/integrations/connections/{provider}/disconnect",
    "namespace": "workspace"
  },
  {
    "id": "disconnectSlackWorkspace",
    "method": "POST",
    "path": "/api/v1/slack/disconnect",
    "namespace": "workspace"
  },
  {
    "id": "downloadFeatureAttachment",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning"
  },
  {
    "id": "downloadSpecAttachment",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning"
  },
  {
    "id": "exchangeLegacyNativeCredential",
    "method": "POST",
    "path": "/api/v1/auth/native/exchange",
    "namespace": "workspace"
  },
  {
    "id": "getActor",
    "method": "GET",
    "path": "/api/v1/actors/{actorId}",
    "namespace": "workspace"
  },
  {
    "id": "getAiSettings",
    "method": "GET",
    "path": "/api/v1/llm-settings",
    "namespace": "activity"
  },
  {
    "id": "getBootstrapStatus",
    "method": "GET",
    "path": "/api/v1/bootstrap-status",
    "namespace": "workspace"
  },
  {
    "id": "getCueProjectActions",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/actions",
    "namespace": "incidents"
  },
  {
    "id": "getCueProjectAlertRules",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/alert-rules",
    "namespace": "incidents"
  },
  {
    "id": "getCueProjectAlerts",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/alerts",
    "namespace": "incidents"
  },
  {
    "id": "getCueProjectDashboard",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/dashboard",
    "namespace": "incidents"
  },
  {
    "id": "getCueProjectStatEvents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/stat-events",
    "namespace": "incidents"
  },
  {
    "id": "getCurrentMember",
    "method": "GET",
    "path": "/api/v1/me",
    "namespace": "workspace"
  },
  {
    "id": "getCurrentWorkSummary",
    "method": "GET",
    "path": "/api/v1/feed/current-summary",
    "namespace": "activity"
  },
  {
    "id": "getEngineerActivity",
    "method": "GET",
    "path": "/api/v1/engineer-activity",
    "namespace": "activity"
  },
  {
    "id": "getEngineerStats",
    "method": "GET",
    "path": "/api/v1/engineer-stats",
    "namespace": "activity"
  },
  {
    "id": "getFeedEvent",
    "method": "GET",
    "path": "/api/v1/events/{id}",
    "namespace": "activity"
  },
  {
    "id": "getGitHubComments",
    "method": "GET",
    "path": "/api/v1/github/comments",
    "namespace": "activity"
  },
  {
    "id": "getGitHubDetails",
    "method": "GET",
    "path": "/api/v1/github/details",
    "namespace": "activity"
  },
  {
    "id": "getGitHubRateLimit",
    "method": "GET",
    "path": "/api/v1/github/rate-limit",
    "namespace": "workspace"
  },
  {
    "id": "getIdentityProfile",
    "method": "GET",
    "path": "/api/v1/auth/profile",
    "namespace": "workspace"
  },
  {
    "id": "getIntegrationStatus",
    "method": "GET",
    "path": "/api/v1/integrations/status",
    "namespace": "workspace"
  },
  {
    "id": "getIssue",
    "method": "GET",
    "path": "/api/v1/issues/{repo}/{number}",
    "namespace": "activity"
  },
  {
    "id": "getNoxCueDailyHealth",
    "method": "GET",
    "path": "/api/v1/cues/metrics",
    "namespace": "incidents"
  },
  {
    "id": "getNoxCueGitHubIssueSettings",
    "method": "GET",
    "path": "/api/v1/cues/github-issues",
    "namespace": "incidents"
  },
  {
    "id": "getNoxCueProjectMetrics",
    "method": "GET",
    "path": "/api/v1/cues/projects/{projectId}/metrics",
    "namespace": "incidents"
  },
  {
    "id": "getNoxCueProjectOverview",
    "method": "GET",
    "path": "/api/v1/cues/project-overview",
    "namespace": "incidents"
  },
  {
    "id": "getNoxFeed",
    "method": "GET",
    "path": "/api/v1/feed",
    "namespace": "activity"
  },
  {
    "id": "getNoxFeedDefaultPrompt",
    "method": "GET",
    "path": "/api/v1/noxfeed/release-notes-prompt",
    "namespace": "activity"
  },
  {
    "id": "getNoxService",
    "method": "GET",
    "path": "/api/v1/services/{service}",
    "namespace": "workspace"
  },
  {
    "id": "getNoxServiceConfig",
    "method": "GET",
    "path": "/api/v1/services/{service}/config",
    "namespace": "workspace"
  },
  {
    "id": "getNoxServiceHealth",
    "method": "GET",
    "path": "/api/v1/services/{service}/health",
    "namespace": "workspace"
  },
  {
    "id": "getNoxServiceSetup",
    "method": "GET",
    "path": "/api/v1/services/{service}/setup",
    "namespace": "workspace"
  },
  {
    "id": "getNoxSpotProjectOverview",
    "method": "GET",
    "path": "/api/v1/spots/project-overview",
    "namespace": "feedback"
  },
  {
    "id": "getNoxSpotResolutionTemplate",
    "method": "GET",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template",
    "namespace": "feedback"
  },
  {
    "id": "getOperatorUsage",
    "method": "GET",
    "path": "/api/v1/operator/usage",
    "namespace": "workspace"
  },
  {
    "id": "getProjectActivity",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/activity",
    "namespace": "workspace"
  },
  {
    "id": "getProjectFeedback",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/feedback",
    "namespace": "workspace"
  },
  {
    "id": "getProjectIncident",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
    "namespace": "workspace"
  },
  {
    "id": "getProjectIncidents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents",
    "namespace": "workspace"
  },
  {
    "id": "getProjectIssues",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/issues",
    "namespace": "workspace"
  },
  {
    "id": "getProjectRouting",
    "method": "GET",
    "path": "/api/v1/projects/routing",
    "namespace": "workspace"
  },
  {
    "id": "getPublicNoxSpotConfig",
    "method": "GET",
    "path": "/api/spots/public/v1/sites/{siteId}/config",
    "namespace": "feedback"
  },
  {
    "id": "getPullRequest",
    "method": "GET",
    "path": "/api/v1/prs/{repo}/{number}",
    "namespace": "activity"
  },
  {
    "id": "getSetupPlan",
    "method": "GET",
    "path": "/api/v1/integrations/setup",
    "namespace": "workspace"
  },
  {
    "id": "getSlackRouting",
    "method": "GET",
    "path": "/api/v1/integrations/slack/routing",
    "namespace": "workspace"
  },
  {
    "id": "getSlackStatus",
    "method": "GET",
    "path": "/api/v1/slack/status",
    "namespace": "workspace"
  },
  {
    "id": "getSpec",
    "method": "GET",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning"
  },
  {
    "id": "getSyncStatus",
    "method": "GET",
    "path": "/api/v1/sync",
    "namespace": "workspace"
  },
  {
    "id": "getWorkspaceConfig",
    "method": "GET",
    "path": "/api/v1/config/{key}",
    "namespace": "workspace"
  },
  {
    "id": "ingestNoxCueEvent",
    "method": "POST",
    "path": "/api/v1/cues/public/events",
    "namespace": "incidents"
  },
  {
    "id": "listActors",
    "method": "GET",
    "path": "/api/v1/actors",
    "namespace": "workspace"
  },
  {
    "id": "listApiTokens",
    "method": "GET",
    "path": "/api/v1/api-tokens",
    "namespace": "workspace"
  },
  {
    "id": "listConnections",
    "method": "GET",
    "path": "/api/v1/integrations/connections",
    "namespace": "workspace"
  },
  {
    "id": "listFeatureAttachments",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning"
  },
  {
    "id": "listFeatures",
    "method": "GET",
    "path": "/api/v1/features",
    "namespace": "planning"
  },
  {
    "id": "listFeedEvents",
    "method": "GET",
    "path": "/api/v1/events",
    "namespace": "activity"
  },
  {
    "id": "listGitHubTeams",
    "method": "GET",
    "path": "/api/v1/teams",
    "namespace": "workspace"
  },
  {
    "id": "listGuestAccess",
    "method": "GET",
    "path": "/api/v1/guests",
    "namespace": "workspace"
  },
  {
    "id": "listIssues",
    "method": "GET",
    "path": "/api/v1/issues",
    "namespace": "activity"
  },
  {
    "id": "listMembers",
    "method": "GET",
    "path": "/api/v1/members",
    "namespace": "workspace"
  },
  {
    "id": "listNoxCueCustomMetrics",
    "method": "GET",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics",
    "namespace": "incidents"
  },
  {
    "id": "listNoxCueEvents",
    "method": "GET",
    "path": "/api/v1/cues/events",
    "namespace": "incidents"
  },
  {
    "id": "listNoxCueFeatures",
    "method": "GET",
    "path": "/api/v1/cues/sources/{sourceId}/features",
    "namespace": "incidents"
  },
  {
    "id": "listNoxCueSources",
    "method": "GET",
    "path": "/api/v1/cues/sources",
    "namespace": "incidents"
  },
  {
    "id": "listNoxServices",
    "method": "GET",
    "path": "/api/v1/services",
    "namespace": "workspace"
  },
  {
    "id": "listNoxSpotSites",
    "method": "GET",
    "path": "/api/v1/spots/sites",
    "namespace": "feedback"
  },
  {
    "id": "listOperationFailures",
    "method": "GET",
    "path": "/api/v1/op-failures",
    "namespace": "workspace"
  },
  {
    "id": "listProjects",
    "method": "GET",
    "path": "/api/v1/projects",
    "namespace": "workspace"
  },
  {
    "id": "listPullRequests",
    "method": "GET",
    "path": "/api/v1/prs",
    "namespace": "activity"
  },
  {
    "id": "listRepositories",
    "method": "GET",
    "path": "/api/v1/repos",
    "namespace": "workspace"
  },
  {
    "id": "listSlackChannels",
    "method": "GET",
    "path": "/api/v1/slack/channels",
    "namespace": "workspace"
  },
  {
    "id": "listSpecAttachments",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning"
  },
  {
    "id": "listSpecs",
    "method": "GET",
    "path": "/api/v1/specs",
    "namespace": "planning"
  },
  {
    "id": "patchNoxServiceConfig",
    "method": "PATCH",
    "path": "/api/v1/services/{service}/config",
    "namespace": "workspace"
  },
  {
    "id": "patchSlackRouting",
    "method": "PATCH",
    "path": "/api/v1/integrations/slack/routing",
    "namespace": "workspace"
  },
  {
    "id": "pollNativeDeviceAuthorization",
    "method": "POST",
    "path": "/api/v1/auth/native/device/poll",
    "namespace": "workspace"
  },
  {
    "id": "previewNoxSpotResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template/preview",
    "namespace": "feedback"
  },
  {
    "id": "putAiSettings",
    "method": "PUT",
    "path": "/api/v1/llm-settings",
    "namespace": "activity"
  },
  {
    "id": "putNoxCueGitHubIssueSettings",
    "method": "PUT",
    "path": "/api/v1/cues/github-issues",
    "namespace": "incidents"
  },
  {
    "id": "putWorkspaceConfig",
    "method": "PUT",
    "path": "/api/v1/config/{key}",
    "namespace": "workspace"
  },
  {
    "id": "recordAppActivity",
    "method": "POST",
    "path": "/api/v1/app-activity",
    "namespace": "workspace"
  },
  {
    "id": "recoverRepositoryHistory",
    "method": "POST",
    "path": "/api/v1/recover-repo-history",
    "namespace": "workspace"
  },
  {
    "id": "refreshNativeSession",
    "method": "POST",
    "path": "/api/v1/auth/native/refresh",
    "namespace": "workspace"
  },
  {
    "id": "reopenResolvedNoxSpotReport",
    "method": "POST",
    "path": "/api/spots/public/v1/resolution-responses/{token}",
    "namespace": "feedback"
  },
  {
    "id": "restoreProject",
    "method": "DELETE",
    "path": "/api/v1/projects/{projectId}/archive",
    "namespace": "workspace"
  },
  {
    "id": "restoreSpec",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning"
  },
  {
    "id": "retrieveProject",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/retrieval",
    "namespace": "workspace"
  },
  {
    "id": "retryNoxSpotDeliveries",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/retry-deliveries",
    "namespace": "feedback"
  },
  {
    "id": "revokeApiToken",
    "method": "DELETE",
    "path": "/api/v1/api-tokens/{id}",
    "namespace": "workspace"
  },
  {
    "id": "revokeBrowserSession",
    "method": "POST",
    "path": "/api/v1/auth/logout",
    "namespace": "workspace"
  },
  {
    "id": "revokeGuestGrant",
    "method": "DELETE",
    "path": "/api/v1/guests/grants/{grantId}",
    "namespace": "workspace"
  },
  {
    "id": "revokeGuestInvitation",
    "method": "DELETE",
    "path": "/api/v1/guests/invites/{inviteId}",
    "namespace": "workspace"
  },
  {
    "id": "revokeNativeSession",
    "method": "POST",
    "path": "/api/v1/auth/native/revoke",
    "namespace": "workspace"
  },
  {
    "id": "revokeNoxCueKey",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/keys/{keyId}",
    "namespace": "incidents"
  },
  {
    "id": "rotateApiToken",
    "method": "POST",
    "path": "/api/v1/api-tokens/{id}/rotate",
    "namespace": "workspace"
  },
  {
    "id": "searchWorkspace",
    "method": "GET",
    "path": "/api/v1/search",
    "namespace": "activity"
  },
  {
    "id": "setIssueState",
    "method": "POST",
    "path": "/api/v1/issue-state",
    "namespace": "planning"
  },
  {
    "id": "startConnection",
    "method": "POST",
    "path": "/api/v1/integrations/connections/{provider}/start",
    "namespace": "workspace"
  },
  {
    "id": "startNativeDeviceAuthorization",
    "method": "POST",
    "path": "/api/v1/auth/native/device/start",
    "namespace": "workspace"
  },
  {
    "id": "submitPublicNoxSpotErrors",
    "method": "POST",
    "path": "/api/spots/public/v1/errors",
    "namespace": "feedback"
  },
  {
    "id": "submitPublicNoxSpotReport",
    "method": "POST",
    "path": "/api/spots/public/v1/reports",
    "namespace": "feedback"
  },
  {
    "id": "syncGitHubData",
    "method": "POST",
    "path": "/api/v1/sync",
    "namespace": "workspace"
  },
  {
    "id": "syncGitHubEvents",
    "method": "POST",
    "path": "/api/v1/sync-events",
    "namespace": "workspace"
  },
  {
    "id": "testNoxCueSource",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/health/test",
    "namespace": "incidents"
  },
  {
    "id": "testNoxSpotResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template/test",
    "namespace": "feedback"
  },
  {
    "id": "testSlackDestination",
    "method": "POST",
    "path": "/api/v1/slack/test",
    "namespace": "workspace"
  },
  {
    "id": "testSlackRoute",
    "method": "POST",
    "path": "/api/v1/integrations/slack/test",
    "namespace": "workspace"
  },
  {
    "id": "updateActor",
    "method": "PATCH",
    "path": "/api/v1/actors/{actorId}",
    "namespace": "workspace"
  },
  {
    "id": "updateCueProjectActions",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/cue/actions",
    "namespace": "incidents"
  },
  {
    "id": "updateFeature",
    "method": "PATCH",
    "path": "/api/v1/features/{number}",
    "namespace": "planning"
  },
  {
    "id": "updateNoxCueCustomFeature",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents"
  },
  {
    "id": "updateNoxCueCustomMetric",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "incidents"
  },
  {
    "id": "updateNoxCueErrorStatus",
    "method": "PUT",
    "path": "/api/v1/cues/errors/{sourceId}/{fingerprint}",
    "namespace": "incidents"
  },
  {
    "id": "updateNoxCueProjectMetrics",
    "method": "PUT",
    "path": "/api/v1/cues/projects/{projectId}/metrics",
    "namespace": "incidents"
  },
  {
    "id": "updateNoxCueSource",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}",
    "namespace": "incidents"
  },
  {
    "id": "updateNoxSpotReport",
    "method": "PATCH",
    "path": "/api/v1/spots/reports/{reportId}",
    "namespace": "feedback"
  },
  {
    "id": "updateNoxSpotResolutionTemplate",
    "method": "PATCH",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template",
    "namespace": "feedback"
  },
  {
    "id": "updateNoxSpotSite",
    "method": "PATCH",
    "path": "/api/v1/spots/sites/{siteId}",
    "namespace": "feedback"
  },
  {
    "id": "updateProjectIncident",
    "method": "PATCH",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
    "namespace": "workspace"
  },
  {
    "id": "updateProjectRouting",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/routing",
    "namespace": "workspace"
  },
  {
    "id": "updateSpec",
    "method": "PATCH",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning"
  },
  {
    "id": "uploadFeatureAttachment",
    "method": "POST",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning"
  },
  {
    "id": "uploadSpecAttachment",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning"
  }
] as const;
export type OperationId = typeof operationDefinitions[number]["id"];
export type ResourceNamespace = typeof operationDefinitions[number]["namespace"];
