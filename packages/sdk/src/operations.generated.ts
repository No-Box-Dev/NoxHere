// Generated from public/openapi.json. Do not edit by hand.
export const operationDefinitions = [
  {
    "id": "acknowledgeRepositories",
    "method": "POST",
    "path": "/api/v1/repos/acknowledge",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "archiveProject",
    "method": "POST",
    "path": "/api/v1/projects/{projectId}/archive",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "archiveSpec",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning",
    "authentication": "admin",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "assignIssue",
    "method": "POST",
    "path": "/api/v1/assign",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "assignSlackConnectionProject",
    "method": "PATCH",
    "path": "/api/v1/slack/connections/{connectionId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "backfillProjectPullRequests",
    "method": "POST",
    "path": "/api/v1/projects/{projectId}/backfill-prs",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "closeFeature",
    "method": "DELETE",
    "path": "/api/v1/features/{number}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "closePullRequest",
    "method": "POST",
    "path": "/api/v1/prs/close",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createApiToken",
    "method": "POST",
    "path": "/api/v1/api-tokens",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createFeature",
    "method": "POST",
    "path": "/api/v1/features",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createFeedbackSite",
    "method": "POST",
    "path": "/api/v1/feedback/sites",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createGrowthKey",
    "method": "POST",
    "path": "/api/v1/growth/sources/{sourceId}/keys",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createGrowthSource",
    "method": "POST",
    "path": "/api/v1/growth/sources",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createGuestInvitation",
    "method": "POST",
    "path": "/api/v1/guests/invites",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createPlanningTask",
    "method": "POST",
    "path": "/api/v1/tasks",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createProject",
    "method": "POST",
    "path": "/api/v1/projects",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createSpec",
    "method": "POST",
    "path": "/api/v1/specs",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createTelemetryCustomFeature",
    "method": "POST",
    "path": "/api/v1/telemetry/sources/{sourceId}/features",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createTelemetryCustomMetric",
    "method": "POST",
    "path": "/api/v1/telemetry/sources/{sourceId}/custom-metrics",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createTelemetryKey",
    "method": "POST",
    "path": "/api/v1/telemetry/sources/{sourceId}/keys",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createTelemetrySource",
    "method": "POST",
    "path": "/api/v1/telemetry/sources",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createUsageKey",
    "method": "POST",
    "path": "/api/v1/usage/sources/{sourceId}/keys",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "createUsageSource",
    "method": "POST",
    "path": "/api/v1/usage/sources",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteFeatureAttachment",
    "method": "DELETE",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteFeedbackSite",
    "method": "DELETE",
    "path": "/api/v1/feedback/sites/{siteId}",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteGrowthSource",
    "method": "DELETE",
    "path": "/api/v1/growth/sources/{sourceId}",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deletePlanningTask",
    "method": "DELETE",
    "path": "/api/v1/tasks/{id}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteSpecAttachment",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteTelemetryCustomFeature",
    "method": "DELETE",
    "path": "/api/v1/telemetry/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteTelemetryCustomMetric",
    "method": "DELETE",
    "path": "/api/v1/telemetry/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteTelemetrySource",
    "method": "DELETE",
    "path": "/api/v1/telemetry/sources/{sourceId}",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "deleteUsageSource",
    "method": "DELETE",
    "path": "/api/v1/usage/sources/{sourceId}",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "disconnectConnection",
    "method": "POST",
    "path": "/api/v1/integrations/connections/{provider}/disconnect",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "disconnectSlackWorkspace",
    "method": "POST",
    "path": "/api/v1/slack/disconnect",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "downloadFeatureAttachment",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/octet-stream"
    ],
    "servers": []
  },
  {
    "id": "downloadFeedbackAsset",
    "method": "GET",
    "path": "/api/v1/feedback/assets/{assetId}",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    "servers": []
  },
  {
    "id": "downloadSpecAttachment",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/octet-stream"
    ],
    "servers": []
  },
  {
    "id": "draftPlanningItem",
    "method": "POST",
    "path": "/api/v1/planning/assist",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "exchangeLegacyNativeCredential",
    "method": "POST",
    "path": "/api/v1/auth/native/exchange",
    "namespace": "workspace",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getActivity",
    "method": "GET",
    "path": "/api/v1/activity",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "activity:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getActivityDefaultPrompt",
    "method": "GET",
    "path": "/api/v1/activity/release-notes-prompt",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getActor",
    "method": "GET",
    "path": "/api/v1/actors/{actorId}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getAiSettings",
    "method": "GET",
    "path": "/api/v1/llm-settings",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getApplicationBootstrap",
    "method": "GET",
    "path": "/api/v1/bootstrap",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getBootstrapStatus",
    "method": "GET",
    "path": "/api/v1/bootstrap-status",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getCurrentMember",
    "method": "GET",
    "path": "/api/v1/me",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getCurrentWorkSummary",
    "method": "GET",
    "path": "/api/v1/activity/current-summary",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getEngineerActivity",
    "method": "GET",
    "path": "/api/v1/engineer-activity",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getEngineerStats",
    "method": "GET",
    "path": "/api/v1/engineer-stats",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getFeedbackProjectOverview",
    "method": "GET",
    "path": "/api/v1/feedback/project-overview",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getFeedbackReport",
    "method": "GET",
    "path": "/api/v1/feedback/reports/{reportId}",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getFeedbackResolutionTemplate",
    "method": "GET",
    "path": "/api/v1/feedback/sites/{siteId}/resolution-template",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getFeedEvent",
    "method": "GET",
    "path": "/api/v1/events/{id}",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getGitHubComments",
    "method": "GET",
    "path": "/api/v1/github/comments",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getGitHubDetails",
    "method": "GET",
    "path": "/api/v1/github/details",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getGitHubRateLimit",
    "method": "GET",
    "path": "/api/v1/github/rate-limit",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getGrowthProjectDashboard",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/growth/dashboard",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getGrowthProjectEvents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/growth/events",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getIdentityProfile",
    "method": "GET",
    "path": "/api/v1/auth/profile",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getIntegrationStatus",
    "method": "GET",
    "path": "/api/v1/integrations/status",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getIssue",
    "method": "GET",
    "path": "/api/v1/issues/{repo}/{number}",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "activity:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getNoxService",
    "method": "GET",
    "path": "/api/v1/services/{service}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getNoxServiceConfig",
    "method": "GET",
    "path": "/api/v1/services/{service}/config",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getNoxServiceHealth",
    "method": "GET",
    "path": "/api/v1/services/{service}/health",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getNoxServiceSetup",
    "method": "GET",
    "path": "/api/v1/services/{service}/setup",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getOperatorUsage",
    "method": "GET",
    "path": "/api/v1/operator/usage",
    "namespace": "workspace",
    "authentication": "platform_operator",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getPersonalTaskWorkflow",
    "method": "GET",
    "path": "/api/v1/task-workflows",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectActivity",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/activity",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectFeedback",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/feedback",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectIncident",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectIncidents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectIssueAlertRules",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/issues/alert-rules",
    "namespace": "issues",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectIssueIncidents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/issues/alerts",
    "namespace": "issues",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectIssues",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/issues",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getProjectRouting",
    "method": "GET",
    "path": "/api/v1/projects/routing",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getPublicFeedbackConfig",
    "method": "GET",
    "path": "/api/feedback/public/v1/sites/{siteId}/config",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "getPublicFeedbackDeliveryStatus",
    "method": "GET",
    "path": "/api/feedback/public/v1/reports/{reportId}/status",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "getPublicFeedbackMembers",
    "method": "GET",
    "path": "/api/feedback/public/v1/sites/{siteId}/members",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "getPullRequest",
    "method": "GET",
    "path": "/api/v1/prs/{repo}/{number}",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "activity:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getSetupPlan",
    "method": "GET",
    "path": "/api/v1/integrations/setup",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getSlackRouting",
    "method": "GET",
    "path": "/api/v1/integrations/slack/routing",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getSlackStatus",
    "method": "GET",
    "path": "/api/v1/slack/status",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getSpec",
    "method": "GET",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getSyncStatus",
    "method": "GET",
    "path": "/api/v1/sync",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryDailyHealth",
    "method": "GET",
    "path": "/api/v1/telemetry/metrics",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryGitHubIssueSettings",
    "method": "GET",
    "path": "/api/v1/telemetry/github-issues",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectActions",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/telemetry/actions",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectAlertRules",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/telemetry/alert-rules",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectAlerts",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/telemetry/alerts",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectDashboard",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/telemetry/dashboard",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectMetrics",
    "method": "GET",
    "path": "/api/v1/telemetry/projects/{projectId}/metrics",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectOverview",
    "method": "GET",
    "path": "/api/v1/telemetry/project-overview",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getTelemetryProjectStatEvents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/telemetry/stat-events",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getUsageProjectActions",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/usage/actions",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getUsageProjectDashboard",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/usage/dashboard",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getUsageProjectEvents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/usage/events",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "getWorkspaceConfig",
    "method": "GET",
    "path": "/api/v1/config/{key}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "ingestGrowthEvent",
    "method": "POST",
    "path": "/api/v1/growth/events",
    "namespace": "growth",
    "authentication": "ingest_key",
    "automationScope": "growth:ingest",
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "ingestTelemetryEvent",
    "method": "POST",
    "path": "/api/v1/telemetry/public/events",
    "namespace": "stats",
    "authentication": "ingest_key",
    "automationScope": "telemetry:ingest",
    "projectScope": "none",
    "changeSafety": "idempotent_with_event_key",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "ingestUsageEvent",
    "method": "POST",
    "path": "/api/v1/usage/events",
    "namespace": "usage",
    "authentication": "ingest_key",
    "automationScope": "usage:ingest",
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listActors",
    "method": "GET",
    "path": "/api/v1/actors",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listApiTokens",
    "method": "GET",
    "path": "/api/v1/api-tokens",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listConnections",
    "method": "GET",
    "path": "/api/v1/integrations/connections",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listFeatureAttachments",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listFeatures",
    "method": "GET",
    "path": "/api/v1/features",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listFeedbackSites",
    "method": "GET",
    "path": "/api/v1/feedback/sites",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": "feedback:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listFeedEvents",
    "method": "GET",
    "path": "/api/v1/events",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listGitHubTeams",
    "method": "GET",
    "path": "/api/v1/teams",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listGrowthKeys",
    "method": "GET",
    "path": "/api/v1/growth/sources/{sourceId}/keys",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listGrowthSources",
    "method": "GET",
    "path": "/api/v1/growth/sources",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listGuestAccess",
    "method": "GET",
    "path": "/api/v1/guests",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listIssues",
    "method": "GET",
    "path": "/api/v1/issues",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "activity:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listMembers",
    "method": "GET",
    "path": "/api/v1/members",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listNoxServices",
    "method": "GET",
    "path": "/api/v1/services",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "services:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listOperationFailures",
    "method": "GET",
    "path": "/api/v1/op-failures",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listOrganizationAuditLog",
    "method": "GET",
    "path": "/api/v1/audit-log",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listOrganizationMemberships",
    "method": "GET",
    "path": "/api/v1/memberships",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listPlanningTasks",
    "method": "GET",
    "path": "/api/v1/tasks",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listProjects",
    "method": "GET",
    "path": "/api/v1/projects",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listPullRequests",
    "method": "GET",
    "path": "/api/v1/prs",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "activity:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listRepositories",
    "method": "GET",
    "path": "/api/v1/repos",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listSlackChannels",
    "method": "GET",
    "path": "/api/v1/slack/channels",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "slack:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listSpecAttachments",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listSpecs",
    "method": "GET",
    "path": "/api/v1/specs",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetryCards",
    "method": "GET",
    "path": "/api/v1/telemetry/sources/{sourceId}/cards",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetryCustomMetrics",
    "method": "GET",
    "path": "/api/v1/telemetry/sources/{sourceId}/custom-metrics",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetryEvents",
    "method": "GET",
    "path": "/api/v1/telemetry/events",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetryFeatures",
    "method": "GET",
    "path": "/api/v1/telemetry/sources/{sourceId}/features",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetryKeys",
    "method": "GET",
    "path": "/api/v1/telemetry/sources/{sourceId}/keys",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listTelemetrySources",
    "method": "GET",
    "path": "/api/v1/telemetry/sources",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listUsageCards",
    "method": "GET",
    "path": "/api/v1/usage/sources/{sourceId}/cards",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listUsageKeys",
    "method": "GET",
    "path": "/api/v1/usage/sources/{sourceId}/keys",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "listUsageSources",
    "method": "GET",
    "path": "/api/v1/usage/sources",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "mergePullRequest",
    "method": "POST",
    "path": "/api/v1/prs/merge",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "patchNoxServiceConfig",
    "method": "PATCH",
    "path": "/api/v1/services/{service}/config",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "conditional_write",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "patchSlackRouting",
    "method": "PATCH",
    "path": "/api/v1/integrations/slack/routing",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "pollNativeDeviceAuthorization",
    "method": "POST",
    "path": "/api/v1/auth/native/device/poll",
    "namespace": "workspace",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "previewFeedbackResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/feedback/sites/{siteId}/resolution-template/preview",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "putAiSettings",
    "method": "PUT",
    "path": "/api/v1/llm-settings",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "putPersonalTaskWorkflow",
    "method": "PUT",
    "path": "/api/v1/task-workflows",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "putTelemetryGitHubIssueSettings",
    "method": "PUT",
    "path": "/api/v1/telemetry/github-issues",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "putWorkspaceConfig",
    "method": "PUT",
    "path": "/api/v1/config/{key}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "recordAppActivity",
    "method": "POST",
    "path": "/api/v1/app-activity",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "recoverRepositoryHistory",
    "method": "POST",
    "path": "/api/v1/recover-repo-history",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "refreshNativeSession",
    "method": "POST",
    "path": "/api/v1/auth/native/refresh",
    "namespace": "workspace",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "reopenResolvedFeedbackReport",
    "method": "POST",
    "path": "/api/feedback/public/v1/resolution-responses/{token}",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "multipart/form-data"
    ],
    "responseContentTypes": [
      "text/html"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "requeueQuarantinedTask",
    "method": "POST",
    "path": "/api/v1/op-failures",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "resendGuestInvitation",
    "method": "POST",
    "path": "/api/v1/guests/invites/{inviteId}/resend",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "restoreProject",
    "method": "DELETE",
    "path": "/api/v1/projects/{projectId}/archive",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "restoreSpec",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning",
    "authentication": "admin",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "retrieveProject",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/retrieval",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "retryFeedbackDeliveries",
    "method": "POST",
    "path": "/api/v1/feedback/sites/{siteId}/retry-deliveries",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeApiToken",
    "method": "DELETE",
    "path": "/api/v1/api-tokens/{id}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeBrowserSession",
    "method": "POST",
    "path": "/api/v1/auth/logout",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "destructive",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeGrowthKey",
    "method": "DELETE",
    "path": "/api/v1/growth/sources/{sourceId}/keys/{keyId}",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeGuestGrant",
    "method": "DELETE",
    "path": "/api/v1/guests/grants/{grantId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeGuestInvitation",
    "method": "DELETE",
    "path": "/api/v1/guests/invites/{inviteId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeNativeSession",
    "method": "POST",
    "path": "/api/v1/auth/native/revoke",
    "namespace": "workspace",
    "authentication": "native_refresh",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "destructive",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeTelemetryKey",
    "method": "DELETE",
    "path": "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "revokeUsageKey",
    "method": "DELETE",
    "path": "/api/v1/usage/sources/{sourceId}/keys/{keyId}",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "rotateApiToken",
    "method": "POST",
    "path": "/api/v1/api-tokens/{id}/rotate",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "rotateGrowthKey",
    "method": "POST",
    "path": "/api/v1/growth/sources/{sourceId}/keys/{keyId}/rotate",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "rotateTelemetryKey",
    "method": "POST",
    "path": "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}/rotate",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "rotateUsageKey",
    "method": "POST",
    "path": "/api/v1/usage/sources/{sourceId}/keys/{keyId}/rotate",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "searchWorkspace",
    "method": "GET",
    "path": "/api/v1/search",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "sendSlackMessage",
    "method": "POST",
    "path": "/api/v1/integrations/slack/messages",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "slack:send",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "setIssueState",
    "method": "POST",
    "path": "/api/v1/issue-state",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "startConnection",
    "method": "POST",
    "path": "/api/v1/integrations/connections/{provider}/start",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "startNativeDeviceAuthorization",
    "method": "POST",
    "path": "/api/v1/auth/native/device/start",
    "namespace": "workspace",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "submitDeveloperFeedback",
    "method": "POST",
    "path": "/api/v1/developer-feedback",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "developer-feedback:write",
    "projectScope": "optional",
    "changeSafety": "idempotent_with_key",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "submitPublicFeedbackErrors",
    "method": "POST",
    "path": "/api/feedback/public/v1/errors",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "submitPublicFeedbackReport",
    "method": "POST",
    "path": "/api/feedback/public/v1/reports",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": [
      {
        "url": "https://app.noxhere.com"
      }
    ]
  },
  {
    "id": "syncGitHubData",
    "method": "POST",
    "path": "/api/v1/sync",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "syncGitHubEvents",
    "method": "POST",
    "path": "/api/v1/sync-events",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "testFeedbackResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/feedback/sites/{siteId}/resolution-template/test",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "testSlackDestination",
    "method": "POST",
    "path": "/api/v1/slack/test",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": "slack:send",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "testSlackRoute",
    "method": "POST",
    "path": "/api/v1/integrations/slack/test",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": "slack:send",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "testTelemetrySource",
    "method": "POST",
    "path": "/api/v1/telemetry/sources/{sourceId}/health/test",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateActor",
    "method": "PATCH",
    "path": "/api/v1/actors/{actorId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateFeature",
    "method": "PATCH",
    "path": "/api/v1/features/{number}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateFeedbackReport",
    "method": "PATCH",
    "path": "/api/v1/feedback/reports/{reportId}",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateFeedbackResolutionTemplate",
    "method": "PATCH",
    "path": "/api/v1/feedback/sites/{siteId}/resolution-template",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "conditional_write",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateFeedbackSite",
    "method": "PATCH",
    "path": "/api/v1/feedback/sites/{siteId}",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "feedback:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateGrowthSource",
    "method": "PUT",
    "path": "/api/v1/growth/sources/{sourceId}",
    "namespace": "growth",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateGuestGrantScope",
    "method": "PATCH",
    "path": "/api/v1/guests/grants/{grantId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateGuestInvitationScope",
    "method": "PATCH",
    "path": "/api/v1/guests/invites/{inviteId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateOrganizationMemberRole",
    "method": "PATCH",
    "path": "/api/v1/memberships/{principalId}",
    "namespace": "workspace",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updatePlanningTask",
    "method": "PATCH",
    "path": "/api/v1/tasks/{id}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateProjectIncident",
    "method": "PATCH",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateProjectRouting",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/routing",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateSpec",
    "method": "PATCH",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryCards",
    "method": "PUT",
    "path": "/api/v1/telemetry/sources/{sourceId}/cards",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryCustomFeature",
    "method": "PUT",
    "path": "/api/v1/telemetry/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryCustomMetric",
    "method": "PUT",
    "path": "/api/v1/telemetry/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryErrorStatus",
    "method": "PUT",
    "path": "/api/v1/telemetry/errors/{sourceId}/{fingerprint}",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryProjectActions",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/telemetry/actions",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetryProjectMetrics",
    "method": "PUT",
    "path": "/api/v1/telemetry/projects/{projectId}/metrics",
    "namespace": "stats",
    "authentication": "member",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateTelemetrySource",
    "method": "PUT",
    "path": "/api/v1/telemetry/sources/{sourceId}",
    "namespace": "stats",
    "authentication": "admin",
    "automationScope": "telemetry:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateUsageCards",
    "method": "PUT",
    "path": "/api/v1/usage/sources/{sourceId}/cards",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateUsageProjectActions",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/usage/actions",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "updateUsageSource",
    "method": "PUT",
    "path": "/api/v1/usage/sources/{sourceId}",
    "namespace": "usage",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "uploadFeatureAttachment",
    "method": "POST",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "multipart/form-data"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  },
  {
    "id": "uploadSpecAttachment",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": "planning:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "multipart/form-data"
    ],
    "responseContentTypes": [
      "application/json"
    ],
    "servers": []
  }
] as const;
export type OperationId = typeof operationDefinitions[number]["id"];
export type ResourceNamespace = typeof operationDefinitions[number]["namespace"];
