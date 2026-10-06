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
    ]
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
    ]
  },
  {
    "id": "archiveSpec",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "assignIssue",
    "method": "POST",
    "path": "/api/v1/assign",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "closeFeature",
    "method": "DELETE",
    "path": "/api/v1/features/{number}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "createFeature",
    "method": "POST",
    "path": "/api/v1/features",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "createNoxCueCustomFeature",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/features",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "createNoxCueCustomMetric",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "createNoxCueKey",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/keys",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "createNoxCueSource",
    "method": "POST",
    "path": "/api/v1/cues/sources",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "createNoxSpotSite",
    "method": "POST",
    "path": "/api/v1/spots/sites",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "createSpec",
    "method": "POST",
    "path": "/api/v1/specs",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteFeatureAttachment",
    "method": "DELETE",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteNoxCueCustomFeature",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteNoxCueCustomMetric",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteNoxCueSource",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteNoxSpotSite",
    "method": "DELETE",
    "path": "/api/v1/spots/sites/{siteId}",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "deleteSpecAttachment",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "downloadFeatureAttachment",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/octet-stream"
    ]
  },
  {
    "id": "downloadSpecAttachment",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments/{attachmentId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/octet-stream"
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "getCueProjectActions",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/actions",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getCueProjectAlertRules",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/alert-rules",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getCueProjectAlerts",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/alerts",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getCueProjectDashboard",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/dashboard",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getCueProjectStatEvents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/cue/stat-events",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "getCurrentWorkSummary",
    "method": "GET",
    "path": "/api/v1/feed/current-summary",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "getIssue",
    "method": "GET",
    "path": "/api/v1/issues/{repo}/{number}",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "noxfeed:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxCueDailyHealth",
    "method": "GET",
    "path": "/api/v1/cues/metrics",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxCueGitHubIssueSettings",
    "method": "GET",
    "path": "/api/v1/cues/github-issues",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxCueProjectMetrics",
    "method": "GET",
    "path": "/api/v1/cues/projects/{projectId}/metrics",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxCueProjectOverview",
    "method": "GET",
    "path": "/api/v1/cues/project-overview",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxFeed",
    "method": "GET",
    "path": "/api/v1/feed",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "noxfeed:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxFeedDefaultPrompt",
    "method": "GET",
    "path": "/api/v1/noxfeed/release-notes-prompt",
    "namespace": "activity",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "getNoxSpotProjectOverview",
    "method": "GET",
    "path": "/api/v1/spots/project-overview",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getNoxSpotResolutionTemplate",
    "method": "GET",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "getProjectIncident",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getProjectIncidents",
    "method": "GET",
    "path": "/api/v1/projects/{projectId}/incidents",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "getPublicNoxSpotConfig",
    "method": "GET",
    "path": "/api/spots/public/v1/sites/{siteId}/config",
    "namespace": "feedback",
    "authentication": "public",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "getPullRequest",
    "method": "GET",
    "path": "/api/v1/prs/{repo}/{number}",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "noxfeed:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "getSpec",
    "method": "GET",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "ingestNoxCueEvent",
    "method": "POST",
    "path": "/api/v1/cues/public/events",
    "namespace": "incidents",
    "authentication": "ingest_key",
    "automationScope": null,
    "projectScope": "none",
    "changeSafety": "idempotent_with_event_key",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "listFeatureAttachments",
    "method": "GET",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listFeatures",
    "method": "GET",
    "path": "/api/v1/features",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "listIssues",
    "method": "GET",
    "path": "/api/v1/issues",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "noxfeed:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "listNoxCueCustomMetrics",
    "method": "GET",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listNoxCueEvents",
    "method": "GET",
    "path": "/api/v1/cues/events",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listNoxCueFeatures",
    "method": "GET",
    "path": "/api/v1/cues/sources/{sourceId}/features",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listNoxCueSources",
    "method": "GET",
    "path": "/api/v1/cues/sources",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "listNoxSpotSites",
    "method": "GET",
    "path": "/api/v1/spots/sites",
    "namespace": "feedback",
    "authentication": "member",
    "automationScope": "noxspot:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "listPullRequests",
    "method": "GET",
    "path": "/api/v1/prs",
    "namespace": "activity",
    "authentication": "member",
    "automationScope": "noxfeed:read",
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "listSlackChannels",
    "method": "GET",
    "path": "/api/v1/slack/channels",
    "namespace": "workspace",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listSpecAttachments",
    "method": "GET",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "listSpecs",
    "method": "GET",
    "path": "/api/v1/specs",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "safe_read",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "previewNoxSpotResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template/preview",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "putNoxCueGitHubIssueSettings",
    "method": "PUT",
    "path": "/api/v1/cues/github-issues",
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "reopenResolvedNoxSpotReport",
    "method": "POST",
    "path": "/api/spots/public/v1/resolution-responses/{token}",
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
    ]
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
    ]
  },
  {
    "id": "restoreSpec",
    "method": "DELETE",
    "path": "/api/v1/specs/{specId}/archive",
    "namespace": "planning",
    "authentication": "admin",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
  },
  {
    "id": "retryNoxSpotDeliveries",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/retry-deliveries",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "revokeNoxCueKey",
    "method": "DELETE",
    "path": "/api/v1/cues/sources/{sourceId}/keys/{keyId}",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "destructive",
    "requestContentTypes": [],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "setIssueState",
    "method": "POST",
    "path": "/api/v1/issue-state",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
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
    ]
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
    ]
  },
  {
    "id": "submitPublicNoxSpotErrors",
    "method": "POST",
    "path": "/api/spots/public/v1/errors",
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
    ]
  },
  {
    "id": "submitPublicNoxSpotReport",
    "method": "POST",
    "path": "/api/spots/public/v1/reports",
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
    ]
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
    ]
  },
  {
    "id": "testNoxCueSource",
    "method": "POST",
    "path": "/api/v1/cues/sources/{sourceId}/health/test",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "testNoxSpotResolutionTemplate",
    "method": "POST",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template/test",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "testSlackDestination",
    "method": "POST",
    "path": "/api/v1/slack/test",
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
    ]
  },
  {
    "id": "testSlackRoute",
    "method": "POST",
    "path": "/api/v1/integrations/slack/test",
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
    ]
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
    ]
  },
  {
    "id": "updateCueProjectActions",
    "method": "PUT",
    "path": "/api/v1/projects/{projectId}/cue/actions",
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
    ]
  },
  {
    "id": "updateFeature",
    "method": "PATCH",
    "path": "/api/v1/features/{number}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxCueCustomFeature",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}/features/{featureKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxCueCustomMetric",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}/custom-metrics/{metricKey}",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxCueErrorStatus",
    "method": "PUT",
    "path": "/api/v1/cues/errors/{sourceId}/{fingerprint}",
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
    ]
  },
  {
    "id": "updateNoxCueProjectMetrics",
    "method": "PUT",
    "path": "/api/v1/cues/projects/{projectId}/metrics",
    "namespace": "incidents",
    "authentication": "member",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxCueSource",
    "method": "PUT",
    "path": "/api/v1/cues/sources/{sourceId}",
    "namespace": "incidents",
    "authentication": "admin",
    "automationScope": "noxcue:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxSpotReport",
    "method": "PATCH",
    "path": "/api/v1/spots/reports/{reportId}",
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
    ]
  },
  {
    "id": "updateNoxSpotResolutionTemplate",
    "method": "PATCH",
    "path": "/api/v1/spots/sites/{siteId}/resolution-template",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "conditional_write",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateNoxSpotSite",
    "method": "PATCH",
    "path": "/api/v1/spots/sites/{siteId}",
    "namespace": "feedback",
    "authentication": "admin",
    "automationScope": "noxspot:write",
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "updateProjectIncident",
    "method": "PATCH",
    "path": "/api/v1/projects/{projectId}/incidents/{incidentId}",
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
    ]
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
    ]
  },
  {
    "id": "updateSpec",
    "method": "PATCH",
    "path": "/api/v1/specs/{specId}",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "application/json"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "uploadFeatureAttachment",
    "method": "POST",
    "path": "/api/v1/features/{number}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "multipart/form-data"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  },
  {
    "id": "uploadSpecAttachment",
    "method": "POST",
    "path": "/api/v1/specs/{specId}/attachments",
    "namespace": "planning",
    "authentication": "member",
    "automationScope": null,
    "projectScope": "optional",
    "changeSafety": "write_not_safe_to_retry",
    "requestContentTypes": [
      "multipart/form-data"
    ],
    "responseContentTypes": [
      "application/json"
    ]
  }
] as const;
export type OperationId = typeof operationDefinitions[number]["id"];
export type ResourceNamespace = typeof operationDefinitions[number]["namespace"];
