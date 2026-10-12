export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface paths {
    "/api/feedback/public/v1/errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a bounded batch of automatic browser errors
         * @description Submit a bounded batch of automatic browser errors. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["submitPublicFeedbackErrors"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/feedback/public/v1/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a public Feedback capture
         * @description Submit feedback from an origin-bound widget. Feedback cannot inspect a host website's login session: the host must explicitly pass its signed-in user through Feedback.identify(...) or Feedback.init({ getReporter }). reporterEmail is retained for resolution mail only when notifyOnResolution is true. An optional HTTPS reporterAvatarUrl is retained as private report metadata and is never copied into GitHub.
         */
        post: operations["submitPublicFeedbackReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/feedback/public/v1/resolution-responses/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reopen a resolved report with optional reporter context
         * @description Consumes the single-use token from a Feedback resolution email, adds an optional response and screenshot to the original GitHub issue, and reopens the issue.
         */
        post: operations["reopenResolvedFeedbackReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/feedback/public/v1/sites/{siteId}/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get effective public widget configuration for the request origin
         * @description Get effective public widget configuration for the request origin. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getPublicFeedbackConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/feedback/public/v1/sites/{siteId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List public Feedback reporter choices for the request origin
         * @description Returns at most 250 human GitHub organization members after validating the site and configured origin. Bots and internal membership metadata are not exposed.
         */
        get: operations["getPublicFeedbackMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get normalized current work, posts, and release notes
         * @description Get normalized current work, posts, and release notes. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/activity/current-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read per-person current-work counts for the selected project
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getCurrentWorkSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/activity/release-notes-prompt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the server-owned Activity release-notes prompt
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getActivityDefaultPrompt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/actors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organization people and identity overlays
         * @description List organization people and identity overlays. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listActors"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/actors/{actorId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one organization identity
         * @description Get one organization identity. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getActor"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update an organization identity overlay
         * @description Update an organization identity overlay. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updateActor"];
        trace?: never;
    };
    "/api/v1/api-tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List redacted API-token metadata
         * @description Requires an authenticated organization-admin browser session. API tokens cannot manage other API tokens.
         */
        get: operations["listApiTokens"];
        put?: never;
        /**
         * Create a scoped API token
         * @description Requires an authenticated organization-admin browser session. API tokens cannot manage other API tokens.
         */
        post: operations["createApiToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/api-tokens/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke an API token
         * @description Requires an authenticated organization-admin browser session. API tokens cannot manage other API tokens.
         */
        delete: operations["revokeApiToken"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/api-tokens/{id}/rotate": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate an API token and return its replacement once
         * @description Requires an authenticated organization-admin browser session. API tokens cannot manage other API tokens.
         */
        post: operations["rotateApiToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/app-activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record bounded first-party app activity
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["recordAppActivity"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign a tracked GitHub issue
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["assignIssue"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke the current browser session
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["revokeBrowserSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/native/device/poll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Poll native GitHub authorization
         * @description NoxHere completes the GitHub exchange server-side and returns its own short-lived access and rotating refresh credentials.
         */
        post: operations["pollNativeDeviceAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/native/device/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start native GitHub authorization
         * @description Returns an opaque NoxHere device handle plus the GitHub verification URI and user code.
         */
        post: operations["startNativeDeviceAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/native/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upgrade a legacy native session
         * @description Temporary one-time migration route for older Activity releases. Normal sign-in uses the brokered device flow.
         */
        post: operations["exchangeLegacyNativeCredential"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/native/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate a native session
         * @description Rotates both native credentials. The previous access and refresh values stop working immediately.
         */
        post: operations["refreshNativeSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/native/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke the current native session
         * @description Send the rotating refresh credential so sign-out can revoke the server session even after the short-lived access credential expires. A valid access bearer remains supported for older clients.
         */
        post: operations["revokeNativeSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the signed-in GitHub identity and organizations
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getIdentityProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/bootstrap-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read initial GitHub synchronization status
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getBootstrapStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/config/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        /**
         * Read one shared workspace configuration document
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getWorkspaceConfig"];
        /**
         * Replace one shared workspace configuration document
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        put: operations["putWorkspaceConfig"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/developer-feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit actionable API or product feedback
         * @description Records one firsthand observation from a developer tool or AI agent. Do not include credentials, personal data, prompts, or full request and response bodies. Use one stable idempotency key per observation and do not post routine success reports.
         */
        post: operations["submitDeveloperFeedback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/engineer-activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get normalized monthly activity for one engineer
         * @description Get normalized monthly activity for one engineer. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getEngineerActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/engineer-stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read current work counts by engineer
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getEngineerStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List detailed Activity events
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["listFeedEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /**
         * Read one detailed Activity event
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getFeedEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Planning features
         * @description List Planning features. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listFeatures"];
        put?: never;
        /**
         * Create a feature
         * @description Create a feature. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createFeature"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/features/{number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Close a feature
         * @description Close a feature. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["closeFeature"];
        options?: never;
        head?: never;
        /**
         * Partially update a feature
         * @description Partially update a feature. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updateFeature"];
        trace?: never;
    };
    "/api/v1/features/{number}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List feature attachments
         * @description List attachments for one Planning feature.
         */
        get: operations["listFeatureAttachments"];
        put?: never;
        /**
         * Upload a bounded feature attachment
         * @description Upload a bounded attachment to one Planning feature.
         */
        post: operations["uploadFeatureAttachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/features/{number}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a feature attachment
         * @description Download one attachment from a Planning feature.
         */
        get: operations["downloadFeatureAttachment"];
        put?: never;
        post?: never;
        /**
         * Delete a feature attachment
         * @description Delete one attachment from a Planning feature.
         */
        delete: operations["deleteFeatureAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/project-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a guest-safe Feedback project overview
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getFeedbackProjectOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/reports/{reportId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a Feedback report status
         * @description Mark a report open, investigating, or resolved and optionally send or retry the reporter's consented resolution email.
         */
        patch: operations["updateFeedbackReport"];
        trace?: never;
    };
    "/api/v1/feedback/sites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Feedback sites
         * @description List Feedback sites. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listFeedbackSites"];
        put?: never;
        /**
         * Create a Feedback site
         * @description Create a Feedback site. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createFeedbackSite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/sites/{siteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a Feedback site and its screenshots
         * @description Delete a Feedback site and its screenshots. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deleteFeedbackSite"];
        options?: never;
        head?: never;
        /**
         * Update a Feedback site including its channel override
         * @description Update a Feedback site including its channel override. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updateFeedbackSite"];
        trace?: never;
    };
    "/api/v1/feedback/sites/{siteId}/resolution-template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the effective Feedback resolution email template
         * @description Returns the site's custom content and appearance or the NoxHere default plus a revision for conditional updates. Organization admins and project-scoped API tokens can use the same endpoint.
         */
        get: operations["getFeedbackResolutionTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update or reset a Feedback resolution email template
         * @description Send the revision returned by GET as If-Match. Set template to null to restore the default. This is the self-service configuration used by the NoxHere UI and is also available to project-scoped API tokens. Postmark is transport-only; NoxHere validates, renders, and snapshots the template used for each resolution.
         */
        patch: operations["updateFeedbackResolutionTemplate"];
        trace?: never;
    };
    "/api/v1/feedback/sites/{siteId}/resolution-template/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Render a safe preview of a draft resolution email template
         * @description Render a safe preview of a draft resolution email template. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["previewFeedbackResolutionTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/sites/{siteId}/resolution-template/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a draft resolution email through NoxHere and Postmark
         * @description The draft does not need to be saved. NoxHere renders the safe email and sends it through its private Postmark-backed email capability.
         */
        post: operations["testFeedbackResolutionTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/sites/{siteId}/retry-deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry blocked deliveries for one Feedback site
         * @description Retry blocked deliveries for one Feedback site. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["retryFeedbackDeliveries"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/github/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read comments for a tracked pull request
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getGitHubComments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/github/details": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read live details for a tracked issue or pull request
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getGitHubDetails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/github/rate-limit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the connected GitHub installation rate limit
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getGitHubRateLimit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List guest invitations and active grants
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["listGuestAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guests/grants/{grantId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grantId: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke active guest access
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        delete: operations["revokeGuestGrant"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guests/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Invite a guest to an organization, project, or capability
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["createGuestInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guests/invites/{inviteId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                inviteId: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke a pending guest invitation
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        delete: operations["revokeGuestInvitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List provider connection state
         * @description List provider connection state. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listConnections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/connections/{provider}/disconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Disconnect a provider
         * @description Disconnect a provider. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["disconnectConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/connections/{provider}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start a provider connection
         * @description Returns a userAction URL for human OAuth approval.
         */
        post: operations["startConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get resumable setup state and next actions
         * @description Get resumable setup state and next actions. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getSetupPlan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/slack/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a Slack message through an existing connection
         * @description Uses the selected encrypted Slack installation. Supports text, Block Kit, image blocks, attachments, metadata, threads, unfurls, author overrides, and client message IDs.
         */
        post: operations["sendSlackMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/slack/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get service-to-channel routing
         * @description Get service-to-channel routing. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getSlackRouting"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Partially update service-to-channel routing
         * @description Partially update service-to-channel routing. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["patchSlackRouting"];
        trace?: never;
    };
    "/api/v1/integrations/slack/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test message through a saved or candidate route
         * @description Send a test message through a saved or candidate route. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["testSlackRoute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read credential-free integration readiness
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getIntegrationStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issue-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open or close a tracked GitHub issue
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["setIssueState"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List tracked GitHub issues
         * @description List tracked GitHub issues. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listIssues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issues/{repo}/{number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one tracked GitHub issue
         * @description Get one tracked GitHub issue. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getIssue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/llm-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get organization AI execution settings
         * @description Get organization AI execution settings. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getAiSettings"];
        /**
         * Set organization AI execution mode
         * @description Set organization AI execution mode. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["putAiSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read membership and NoxHere role for the current organization
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getCurrentMember"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List members visible through the connected GitHub organization
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/op-failures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List recent background-operation failures
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["listOperationFailures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/operator/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read platform-wide operator usage
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getOperatorUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/planning/assist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Draft a Planning feature or task with managed AI
         * @description Draft a Planning feature or task with managed AI. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["draftPlanningItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List active projects used by feature setup
         * @description List active projects used by feature setup. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listProjects"];
        put?: never;
        /**
         * Create an empty project scope
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["createProject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List NoxHere projects, repository assignments, and product destinations
         * @description List NoxHere projects, repository assignments, and product destinations. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectRouting"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project activity
         * @description Read project activity. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Stop tracking a project without deleting it
         * @description Stop tracking a project without deleting it. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["archiveProject"];
        /**
         * Resume tracking an eligible project
         * @description Resume tracking an eligible project. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["restoreProject"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/backfill-prs": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Queue bounded Activity pull-request history
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["backfillProjectPullRequests"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project feedback
         * @description Read project feedback. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectFeedback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/incidents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project incidents
         * @description Read project incidents. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectIncidents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/incidents/{incidentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one project incident
         * @description Read one project incident. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectIncident"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update one project incident
         * @description Update one project incident. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updateProjectIncident"];
        trace?: never;
    };
    "/api/v1/projects/{projectId}/issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project issues
         * @description Read project issues. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getProjectIssues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/retrieval": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        /**
         * Search the selected project across Nox services
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["retrieveProject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Atomically update one project's repositories and named Slack destinations
         * @description Atomically update one project's repositories and named Slack destinations. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateProjectRouting"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/telemetry/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project Telemetry actions
         * @description Read project Telemetry actions. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectActions"];
        /**
         * Update project Telemetry actions
         * @description Update project Telemetry actions. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetryProjectActions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/telemetry/alert-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project Telemetry alert rules
         * @description Read project Telemetry alert rules. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectAlertRules"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/telemetry/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project Telemetry alerts
         * @description Read project Telemetry alerts. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/telemetry/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the project Telemetry dashboard
         * @description Read the project Telemetry dashboard. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectDashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/telemetry/stat-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read project Telemetry statistic events
         * @description Read project Telemetry statistic events. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectStatEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List tracked pull requests
         * @description List tracked pull requests. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listPullRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prs/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Close a pull request through GitHub
         * @description Close a pull request through GitHub. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["closePullRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prs/{repo}/{number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one tracked pull request
         * @description Get one tracked pull request. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getPullRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recover-repo-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Recover bounded repository history
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["recoverRepositoryHistory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/repos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List tracked repositories or include all discovered repositories
         * @description List tracked repositories or include all discovered repositories. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listRepositories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/repos/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Acknowledge newly discovered repositories
         * @description Acknowledge newly discovered repositories. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["acknowledgeRepositories"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search accessible project data with combinable filters
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["searchWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/services": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Nox services, their focus, capabilities, and setup readiness
         * @description List Nox services, their focus, capabilities, and setup readiness. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listNoxServices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/services/{service}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get capabilities and setup readiness for one Nox service
         * @description Get capabilities and setup readiness for one Nox service. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getNoxService"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/services/{service}/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the settings owned by one service
         * @description Returns an ETag and matching revision. Provider credentials are never included.
         */
        get: operations["getNoxServiceConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Partially update the settings owned by one service
         * @description Admin-only. Send the ETag from the latest GET as If-Match to prevent lost updates.
         */
        patch: operations["patchNoxServiceConfig"];
        trace?: never;
    };
    "/api/v1/services/{service}/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get service readiness and connection checks
         * @description Get service readiness and connection checks. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getNoxServiceHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/services/{service}/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get setup state, sections, blockers, and capabilities for one service
         * @description Get setup state, sections, blockers, and capabilities for one service. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getNoxServiceSetup"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/slack/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List channels visible to the connected Nox bot
         * @description List channels visible to the connected Nox bot. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listSlackChannels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/slack/connections/{connectionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Manage a Slack workspace connection
         * @description Set a recognizable display name or assign the workspace to a project. One workspace may be organization-wide; with multiple workspaces, every connection requires a project.
         */
        patch: operations["assignSlackConnectionProject"];
        trace?: never;
    };
    "/api/v1/slack/disconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Disconnect one Slack workspace
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["disconnectSlackWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/slack/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read Slack connections and delivery health
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getSlackStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/slack/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test message to a Slack destination
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["testSlackDestination"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/specs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Planning specifications
         * @description List Planning specifications. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listSpecs"];
        put?: never;
        /**
         * Create a specification
         * @description Create a specification. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createSpec"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/specs/{specId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one specification
         * @description Get one specification. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getSpec"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Partially update or relink a specification
         * @description Partially update or relink a specification. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updateSpec"];
        trace?: never;
    };
    "/api/v1/specs/{specId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Archive a specification
         * @description Archive a specification. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["archiveSpec"];
        /**
         * Restore a specification
         * @description Restore a specification. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["restoreSpec"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/specs/{specId}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List specification attachments
         * @description List specification attachments. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listSpecAttachments"];
        put?: never;
        /**
         * Upload a bounded specification attachment
         * @description Upload a bounded specification attachment. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["uploadSpecAttachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/specs/{specId}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a specification attachment
         * @description Download a specification attachment. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["downloadSpecAttachment"];
        put?: never;
        post?: never;
        /**
         * Delete a specification attachment
         * @description Delete a specification attachment. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deleteSpecAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read GitHub synchronization freshness
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getSyncStatus"];
        put?: never;
        /**
         * Synchronize bounded GitHub data
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["syncGitHubData"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Backfill bounded GitHub activity events
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["syncGitHubEvents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/task-workflows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a personal task workflow
         * @description Get the task columns chosen by a project member, or the standard Getting Things Done workflow when they have not customized them. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getPersonalTaskWorkflow"];
        /**
         * Replace a personal task workflow
         * @description Replace the signed-in member's personal task columns. Each member can change only their own workflow. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["putPersonalTaskWorkflow"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Planning tasks
         * @description List Planning tasks. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listPlanningTasks"];
        put?: never;
        /**
         * Create a Planning task
         * @description Create a Planning task. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createPlanningTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a Planning task
         * @description Delete a Planning task. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deletePlanningTask"];
        options?: never;
        head?: never;
        /**
         * Update a Planning task
         * @description Update a Planning task. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        patch: operations["updatePlanningTask"];
        trace?: never;
    };
    "/api/v1/teams": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List teams visible through the connected GitHub organization
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["listGitHubTeams"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/errors/{sourceId}/{fingerprint}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update an error incident status
         * @description Acknowledge, resolve, or reopen one Telemetry error group in the optional project context.
         */
        put: operations["updateTelemetryErrorStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List recent Telemetry events and Slack delivery state
         * @description List recent Telemetry events and Slack delivery state. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listTelemetryEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/github-issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List project GitHub-incident settings
         * @description Returns each active project's repository mapping, routing policy, and open Telemetry incident count.
         */
        get: operations["getTelemetryGitHubIssueSettings"];
        /**
         * Update project GitHub-incident settings
         * @description Controls whether Telemetry opens or updates a GitHub issue for incidents in the selected project and environments.
         */
        put: operations["putTelemetryGitHubIssueSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get stored Telemetry-derived user metrics and digest state
         * @description Get stored Telemetry-derived user metrics and digest state. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryDailyHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/project-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a guest-safe Telemetry project overview
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getTelemetryProjectOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/projects/{projectId}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List selectable metrics and their active event status for one project
         * @description List selectable metrics and their active event status for one project. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["getTelemetryProjectMetrics"];
        /**
         * Choose metrics included in one project's daily report
         * @description Choose metrics included in one project's daily report. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetryProjectMetrics"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/public/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit one standardized Telemetry event through the stable NoxHere gateway
         * @description Authenticated by X-Nox-Ingest-Key. Supply eventId or idempotencyKey when retrying error and feature events. User lifecycle facts are intrinsically deduplicated by source, user, type, and period.
         */
        post: operations["ingestTelemetryEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Telemetry sources, linked projects, and ingest keys
         * @description List Telemetry sources, linked projects, and ingest keys. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listTelemetrySources"];
        put?: never;
        /**
         * Create a Telemetry event source
         * @description Create a Telemetry event source. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createTelemetrySource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update a Telemetry event source
         * @description Update a Telemetry event source. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetrySource"];
        post?: never;
        /**
         * Delete a Telemetry source and revoke its keys
         * @description Delete a Telemetry source and revoke its keys. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deleteTelemetrySource"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/cards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List source-scoped Telemetry report card configuration
         * @description List source-scoped Telemetry report card configuration. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listTelemetryCards"];
        /**
         * Replace source-scoped Telemetry report card configuration
         * @description Replace source-scoped Telemetry report card configuration. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetryCards"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/custom-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List registered custom activity metrics and event status
         * @description List registered custom activity metrics and event status. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listTelemetryCustomMetrics"];
        put?: never;
        /**
         * Register a custom activity metric before ingest
         * @description Register a custom activity metric before ingest. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createTelemetryCustomMetric"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/custom-metrics/{metricKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Rename or pause a registered custom activity metric
         * @description Rename or pause a registered custom activity metric. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetryCustomMetric"];
        post?: never;
        /**
         * Delete a custom metric definition while retaining historical events
         * @description Delete a custom metric definition while retaining historical events. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deleteTelemetryCustomMetric"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List standard and registered custom features with health
         * @description Linked sources share their project's custom catalog. Unlinked sources have an isolated source catalog.
         */
        get: operations["listTelemetryFeatures"];
        put?: never;
        /**
         * Register a custom Telemetry feature before ingest
         * @description Register a custom Telemetry feature before ingest. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["createTelemetryCustomFeature"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/features/{featureKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update or pause a registered custom feature
         * @description Update or pause a registered custom feature. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        put: operations["updateTelemetryCustomFeature"];
        post?: never;
        /**
         * Delete a custom feature definition while retaining historical results
         * @description Delete a custom feature definition while retaining historical results. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["deleteTelemetryCustomFeature"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/health/test": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test a Telemetry source destination
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["testTelemetrySource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Telemetry key metadata, usage, and audit history
         * @description List Telemetry key metadata, usage, and audit history. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        get: operations["listTelemetryKeys"];
        put?: never;
        /**
         * Create a one-time Telemetry browser or server ingest key
         * @description The key value is returned once. Do not log it.
         */
        post: operations["createTelemetryKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke a Telemetry ingest key
         * @description Revoke a Telemetry ingest key. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        delete: operations["revokeTelemetryKey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/telemetry/sources/{sourceId}/keys/{keyId}/rotate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate a Telemetry ingest key with a 24-hour overlap
         * @description Rotate a Telemetry ingest key with a 24-hour overlap. This canonical NoxHere operation uses the authentication, project scope, and retry-safety metadata shown below.
         */
        post: operations["rotateTelemetryKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ActivityActor: {
            /** Format: uri */
            avatarUrl: string | null;
            login: string;
            name: string | null;
        };
        ActivityConfigPatch: {
            releaseNotesPrompt?: string | null;
        };
        ActivityEvent: {
            actor: components["schemas"]["ActivityActor"];
            /** Format: date-time */
            createdAt: string;
            id: string;
            pr: components["schemas"]["ActivityPullRequest"] | null;
            repo: string;
            summary: string;
            technicalSummary: string;
            /** @enum {string} */
            type: "opened" | "merged" | "release-notes";
        };
        ActivityPage: {
            events: components["schemas"]["ActivityEvent"][];
            nextCursor: string | null;
        };
        ActivityPullRequest: {
            number: number;
            title: string;
            /** Format: uri */
            url: string;
        };
        ActorPatch: {
            avatar_url?: string | null;
            github_user_id?: string | null;
            kind?: string | null;
            name?: string | null;
            tone?: string | null;
        };
        AiSettings: {
            managed: {
                available: boolean;
                model: string;
                provider: string;
                services: {
                    activity: components["schemas"]["ManagedAiServiceStatus"];
                    noxhere: components["schemas"]["ManagedAiServiceStatus"];
                };
            };
            /** @enum {string} */
            mode: "disabled" | "managed";
        };
        ApiRecord: {
            [key: string]: unknown;
        };
        ApiTokenCreate: {
            /**
             * @default live
             * @enum {string}
             */
            environment: "live" | "test";
            /** @default 90 */
            expiresInDays: number;
            name: string;
            /** @description One enabled NoxHere project. The token cannot access resources assigned to another project. */
            projectId: string;
            scopes: string[];
        };
        ApiV1Error: {
            /** @constant */
            apiVersion: 1;
            error: {
                code: string;
                details?: unknown;
                message: string;
            };
        };
        CapabilityOperation: {
            /** @enum {string} */
            authentication: "member" | "admin" | "public" | "ingest_key";
            description: string;
            id: string;
            /** @enum {string} */
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path: string;
        };
        DeveloperFeedbackCreate: {
            /** @enum {string} */
            area: "api" | "documentation" | "sdk" | "product" | "other";
            /** @enum {string} */
            category: "bug" | "friction" | "suggestion" | "missing_capability" | "other";
            client?: {
                name: string;
                version?: string;
            };
            details: string;
            /** @description Stable per observation. Reusing it from the same credential returns the original receipt. */
            idempotencyKey: string;
            /** @enum {string} */
            impact?: "low" | "medium" | "high";
            operationId?: string;
            suggestedChange?: string;
            summary: string;
        };
        DeveloperFeedbackReceipt: {
            /** @enum {integer} */
            apiVersion: 1;
            feedback: {
                /** Format: date-time */
                createdAt: string;
                duplicate: boolean;
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                status: "received";
            };
        };
        /** @description Planning feature mirrored from its GitHub issue, including number, title, workflow status, owners, labels, and project. */
        Feature: components["schemas"]["ApiRecord"];
        FeatureCreate: {
            backlog?: boolean;
            owners?: string[];
            plan?: string;
            status?: string;
            title: string;
        };
        FeatureList: components["schemas"]["Feature"][];
        FeaturePatch: {
            backlog?: boolean;
            owners?: string[];
            plan?: string;
            /** @enum {string} */
            state?: "open" | "closed";
            status?: string;
            title?: string;
        };
        FeedActor: {
            /** Format: uri */
            avatarUrl: string | null;
            login: string;
            name: string | null;
        };
        FeedEvent: {
            actor: components["schemas"]["FeedActor"];
            /** Format: date-time */
            createdAt: string;
            id: string;
            pr: components["schemas"]["FeedPullRequest"] | null;
            repo: string;
            summary: string;
            technicalSummary: string;
            /** @enum {string} */
            type: "opened" | "merged" | "release-notes";
        };
        FeedPage: {
            events: components["schemas"]["FeedEvent"][];
            nextCursor: string | null;
        };
        FeedPullRequest: {
            number: number;
            title: string;
            /** Format: uri */
            url: string;
        };
        FeedbackBlock: {
            environments?: string[];
            id: string;
            label?: string | null;
            options?: string[];
            required?: boolean;
            /** @enum {string} */
            type: "title" | "description" | "reporter" | "contact_email" | "category" | "custom_text" | "custom_textarea" | "custom_select" | "element_picker" | "metadata" | "console_logs";
        };
        FeedbackEnvironment: {
            buttonColor?: string | null;
            buttonText?: string | null;
            /** @enum {string|null} */
            captureMode?: "screenshot" | "dom" | null;
            enabled?: boolean;
            name: string;
            url: string;
            /** @enum {string|null} */
            widgetMode?: "development" | "release" | null;
        };
        FeedbackErrorBatch: {
            errors: ({
                message: string;
                title?: string;
                /** Format: uri */
                url?: string;
            } & {
                [key: string]: unknown;
            })[];
            siteId: string;
        };
        FeedbackReport: {
            blockValues?: {
                [key: string]: string;
            } | null;
            context?: Record<string, never> | null;
            description?: string | null;
            elements?: Record<string, never>[] | null;
            environment?: string | null;
            metadata?: Record<string, never> | null;
            /**
             * @description Explicit consent to retain the reporter email and send a transactional update when the report is resolved. Must not be true without reporter consent and requires reporterEmail.
             * @default false
             */
            notifyOnResolution: boolean;
            rating?: number | null;
            reporter?: string | null;
            /**
             * Format: uri
             * @description Optional signed-in reporter profile picture supplied explicitly by the host. It is private report metadata and is never copied into GitHub.
             */
            reporterAvatarUrl?: string | null;
            /**
             * Format: email
             * @description Reporter email supplied explicitly by the host or reporter. It is never inferred from the website session and is not copied into GitHub.
             */
            reporterEmail?: string | null;
            /** @description Bounded PNG, JPEG, or WebP data URL */
            screenshot?: string | null;
            siteId: string;
            title: string;
            /** @enum {string} */
            type?: "bug" | "feature" | "feedback";
        };
        /** @description Site-level content and brand presentation for Feedback resolution emails. Every site can configure this in NoxHere or with a project-scoped API token. Only {{report_title}} and {{site_name}} placeholders are accepted. NoxHere owns the evidence rules, AI safety prompt, safe HTML rendering, verified sender address, and reopen behavior. */
        FeedbackResolutionTemplate: {
            acknowledgement: string;
            appearance: {
                accentColor: string;
                backgroundColor: string;
                /**
                 * @description Email-safe font stack. Custom fonts fall back safely when the recipient's client does not support them.
                 * @enum {string}
                 */
                fontPreset: "system" | "playnist" | "humanist" | "editorial" | "mono";
                mutedColor: string;
                surfaceColor: string;
                textColor: string;
            };
            buttonLabel: string;
            closing: string;
            reopenText: string;
            /** Format: email */
            replyTo: string | null;
            /** @description Display name shown next to the platform's verified sending address. */
            senderName: string;
            subject: string;
            /** @enum {string} */
            tone: "default" | "warm" | "formal" | "concise";
        };
        FeedbackResolutionTemplateDocument: {
            defaults: components["schemas"]["FeedbackResolutionTemplate"];
            revision: string;
            template: components["schemas"]["FeedbackResolutionTemplate"];
            usingDefault: boolean;
        };
        FeedbackSiteCreate: {
            autoErrorLogging?: boolean;
            buttonColor?: string;
            buttonText?: string;
            name: string;
            projectId: string;
            /** @enum {string} */
            widgetMode?: "development" | "release";
        };
        FeedbackSitePatch: {
            autoErrorLogging?: boolean;
            blocks?: components["schemas"]["FeedbackBlock"][];
            buttonColor?: string;
            buttonText?: string;
            environments?: components["schemas"]["FeedbackEnvironment"][];
            slackChannelId?: string | null;
            slackConnectionId?: string | null;
            /** @enum {string} */
            widgetMode?: "development" | "release";
        };
        IncidentAlert: {
            environment: string;
            fingerprint: string;
            /** Format: date-time */
            happenedAt: string;
            id: string;
            occurrences: number;
            sourceId: string;
            /** @enum {string} */
            status: "active" | "resolved";
            summary: string;
            title: string;
        };
        IncidentAlertList: components["schemas"]["IncidentAlert"][];
        IncidentAlertRule: {
            condition: string;
            enabled: boolean;
            environment: string;
            id: string;
            /** @enum {string} */
            kind: "feature" | "error" | "health";
            name: string;
            source: string;
        };
        IncidentAlertRuleList: components["schemas"]["IncidentAlertRule"][];
        /** @description Legacy response whose stable typed schema has not yet been promoted into API v1. */
        JsonValue: JsonValue;
        LegacyError: {
            error: string;
        };
        ManagedAiServiceStatus: {
            available: boolean;
            model: string;
            provider: string;
        };
        MutationReceipt: {
            ok?: boolean;
            status?: string;
            /** Format: date-time */
            updatedAt?: string;
        } & {
            [key: string]: unknown;
        };
        NoxHereConfigPatch: {
            enabledServices?: {
                activity?: boolean;
                feedback?: boolean;
                planning?: boolean;
                telemetry?: boolean;
            };
            /** @enum {string} */
            newRepositoryPolicy?: "include" | "exclude";
        };
        NoxService: {
            capabilities: components["schemas"]["ServiceCapability"][];
            description: string;
            enabled: boolean;
            focus: string;
            /** @enum {string} */
            id: "noxhere" | "planning" | "activity" | "feedback" | "telemetry";
            /** @enum {string} */
            kind: "foundation" | "product";
            links: {
                config: string;
                health: string;
                self: string;
                setup: string;
            };
            name: string;
            setup: components["schemas"]["ServiceSetup"];
        };
        OrganizationReference: {
            login: string;
        };
        PaginatedRecords: {
            data: components["schemas"]["ApiRecord"][];
            page: number;
            pageSize: number;
            totalCount: number;
        } & {
            [key: string]: unknown;
        };
        PlanningAssistFeature: {
            number: number;
            owners?: string[];
            title: string;
        };
        PlanningAssistRequest: {
            features?: components["schemas"]["PlanningAssistFeature"][];
            /** @enum {string} */
            kind: "feature" | "task";
            owner?: string;
            prompt: string;
        };
        PlanningAssistResponse: {
            draft: {
                featureNumber: number | null;
                title: string;
            };
        };
        PlanningConfigPatch: {
            featureRepository?: string | null;
            workflow?: {
                stages: {
                    color: string;
                    id: string;
                    label: string;
                }[];
            };
        };
        PlanningTask: {
            color: components["schemas"]["PlanningTaskColor"];
            /** Format: date-time */
            completedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            createdBy: string;
            featureNumber: number | null;
            /** Format: uuid */
            id: string;
            note: string;
            owner: string;
            position: number;
            stageId: string;
            /** @enum {string} */
            status: "open" | "completed";
            title: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @enum {string} */
        PlanningTaskColor: "gray" | "blue" | "purple" | "green" | "yellow" | "orange" | "red" | "pink";
        PlanningTaskCreate: {
            color?: components["schemas"]["PlanningTaskColor"];
            featureNumber?: number | null;
            note?: string;
            owner?: string;
            position?: number;
            /** @default inbox */
            stageId: string;
            title: string;
        };
        PlanningTaskPatch: {
            color?: components["schemas"]["PlanningTaskColor"];
            featureNumber?: number | null;
            note?: string;
            owner?: string;
            position?: number;
            stageId?: string;
            /** @enum {string} */
            status?: "open" | "completed";
            title?: string;
        };
        ProjectDestination: {
            channelId: string;
            connectionId: string;
        };
        ProjectIncident: {
            /** Format: date-time */
            acknowledgedAt: string | null;
            acknowledgedBy: string | null;
            component: string | null;
            environment: string | null;
            errorCode: string | null;
            fingerprint: string;
            /** Format: date-time */
            firstSeenAt: string;
            id: string;
            /** Format: date-time */
            lastSeenAt: string;
            occurrenceCount: number;
            /** Format: date-time */
            resolvedAt: string | null;
            resolvedBy: string | null;
            sourceId: string;
            sourceName?: string;
            /** @enum {string} */
            status: "open" | "acknowledged" | "resolved";
            title: string;
            /** Format: date-time */
            updatedAt?: string;
        };
        /** @description Incident overview for the selected project, including active sources and unresolved error groups. */
        ProjectIncidentOverview: {
            errors: ({
                environment: string;
                fingerprint: string;
                id: string;
                /** Format: date-time */
                last_seen_at: string;
                occurrence_count: number;
                source_id: string;
                source_name: string;
                title: string;
            } & {
                [key: string]: unknown;
            })[];
            metrics: ({
                metric_key: string;
                origin: string;
                /** Format: date */
                period: string;
                source_id: string;
                source_name: string;
                value: number;
            } & {
                [key: string]: unknown;
            })[];
            project: {
                id: string;
                name: string;
            } | null;
            sources: ({
                environment: string;
                id: string;
                /** Format: date-time */
                last_activity_at?: string | null;
                /** Format: date-time */
                last_registration_at?: string | null;
                name: string;
            } & {
                [key: string]: unknown;
            })[];
        };
        ProjectIncidentResponse: {
            incident: components["schemas"]["ProjectIncident"];
        };
        ProjectIncidentUpdate: {
            /** @enum {string} */
            status: "open" | "acknowledged" | "resolved";
        };
        ProjectRoutingInput: {
            /** @description Whether this repository-mirror row is explicitly enabled as a NoxHere routing project */
            enabled: boolean;
            repositories: string[];
            routes: {
                activityPosts: components["schemas"]["ProjectDestination"];
                activityReleaseNotes: components["schemas"]["ProjectDestination"];
                telemetry: components["schemas"]["ProjectDestination"];
                telemetryAlerts: components["schemas"]["ProjectDestination"];
            };
        };
        /** @enum {string} */
        ProviderConnectionState: "ready" | "connecting" | "disconnected" | "degraded" | "unavailable";
        RecordCollection: components["schemas"]["ApiRecord"][] | components["schemas"]["PaginatedRecords"] | components["schemas"]["ApiRecord"];
        RouteTest: {
            /** @description Optional candidate channel; otherwise uses saved routing and fallback. */
            channelId?: string;
            /** @enum {string} */
            route: "fallback" | "telemetry" | "planning" | "activity_posts" | "activity_release_notes";
        };
        RoutingPatch: {
            routes: {
                activity_posts?: string | null;
                activity_release_notes?: string | null;
                fallback?: string | null;
                planning?: string | null;
                telemetry?: string | null;
            };
        };
        ServiceCapability: {
            /** @enum {string} */
            access: "member" | "admin";
            blockers: ("github" | "slack")[];
            description: string;
            id: string;
            name: string;
            operations: components["schemas"]["CapabilityOperation"][];
            requires: ("github" | "slack")[];
            /** @enum {string} */
            state: "ready" | "blocked" | "disabled";
        };
        ServiceCatalog: {
            /** @constant */
            apiVersion: 1;
            canConfigure: boolean;
            organization: components["schemas"]["OrganizationReference"];
            services: components["schemas"]["NoxService"][];
        };
        ServiceConfig: {
            /** @constant */
            apiVersion: 1;
            /** @description Shape depends on service. Feedback and Telemetry configuration is resource-scoped and linked from links.resources. */
            config: Record<string, never>;
            configuration: {
                /** @enum {string} */
                mode: "service" | "resource";
                writable: boolean;
                writableFields: string[];
            };
            links: components["schemas"]["ServiceLinks"];
            organization: components["schemas"]["OrganizationReference"];
            revision: string;
            /** @constant */
            schemaVersion: 1;
            service: components["schemas"]["ServiceId"];
        };
        ServiceConfigPatch: components["schemas"]["NoxHereConfigPatch"] | components["schemas"]["PlanningConfigPatch"] | components["schemas"]["ActivityConfigPatch"] | Record<string, never>;
        ServiceConnectionRequirement: {
            /** @enum {string} */
            provider: "github" | "slack";
            /** @enum {string} */
            requirement: "required" | "optional";
            state: components["schemas"]["ProviderConnectionState"];
        };
        ServiceDetail: {
            /** @constant */
            apiVersion: 1;
            canConfigure: boolean;
            organization: components["schemas"]["OrganizationReference"];
            service: components["schemas"]["NoxService"];
        };
        ServiceHealth: {
            /** @constant */
            apiVersion: 1;
            /** Format: date-time */
            checkedAt: string;
            checks: {
                detail?: string;
                id: string;
                required: boolean;
                /** @enum {string} */
                state: "pass" | "warn" | "fail";
            }[];
            links: components["schemas"]["ServiceLinks"];
            organization: components["schemas"]["OrganizationReference"];
            service: components["schemas"]["ServiceId"];
            /** @enum {string} */
            state: "healthy" | "degraded" | "blocked" | "disabled";
        };
        /** @enum {string} */
        ServiceId: "noxhere" | "planning" | "activity" | "feedback" | "telemetry";
        ServiceLinks: {
            health: string;
            resources: {
                [key: string]: string;
            };
            self: string;
            setup: string;
        };
        ServiceSetup: {
            blockers: {
                /** @enum {string} */
                provider: "github" | "slack";
                state: components["schemas"]["ProviderConnectionState"];
                /** @constant */
                type: "connection";
            }[];
            connections: components["schemas"]["ServiceConnectionRequirement"][];
            sections: {
                capabilityIds: string[];
                id: string;
                name: string;
            }[];
            /** @enum {string} */
            state: "ready" | "needs_setup" | "disabled";
        };
        ServiceSetupDetail: {
            /** @constant */
            apiVersion: 1;
            blockers: Record<string, never>[];
            canConfigure: boolean;
            capabilities: components["schemas"]["ServiceCapability"][];
            connections: components["schemas"]["ServiceConnectionRequirement"][];
            links: components["schemas"]["ServiceLinks"];
            organization: components["schemas"]["OrganizationReference"];
            sections: {
                capabilityIds: string[];
                id: string;
                name: string;
                /** @enum {string} */
                state: "ready" | "blocked" | "disabled";
            }[];
            service: components["schemas"]["ServiceId"];
            /** @enum {string} */
            state: "ready" | "needs_setup" | "disabled";
        };
        SetupPlan: {
            apiVersion: number;
            complete: boolean;
            steps: {
                [key: string]: components["schemas"]["SetupStep"];
            };
        };
        SetupStep: {
            action?: Record<string, never> | null;
            automatable: boolean;
            required: boolean;
            /** @enum {string} */
            state: "available" | "blocked" | "complete";
            title: string;
        };
        SlackMessageDelivery: {
            /** @constant */
            apiVersion: 1;
            delivery: {
                channelId: string;
                connectionId: string;
                messageTs: string;
                /** Format: date-time */
                sentAt: string;
                /** @constant */
                status: "sent";
            };
        };
        SlackMessagePayload: {
            attachments?: {
                [key: string]: unknown;
            }[];
            blocks?: {
                [key: string]: unknown;
            }[];
            /** Format: uuid */
            client_msg_id?: string;
            icon_emoji?: string;
            /** Format: uri */
            icon_url?: string;
            link_names?: boolean;
            markdown_text?: string;
            metadata?: {
                event_payload: {
                    [key: string]: unknown;
                };
                event_type: string;
            };
            mrkdwn?: boolean;
            /** @enum {string} */
            parse?: "none" | "full";
            reply_broadcast?: boolean;
            text?: string;
            thread_ts?: string;
            unfurl_links?: boolean;
            unfurl_media?: boolean;
            username?: string;
        };
        SlackMessageRequest: {
            channelId: string;
            connectionId: string;
            message: components["schemas"]["SlackMessagePayload"];
        };
        SlackProjectAssignment: {
            /** @description Optional organization-facing name for this connection. Null restores the Slack workspace name. */
            displayName?: string | null;
            /** @description Project to own this workspace. Null is allowed only while it is the organization's sole workspace. */
            projectId?: string | null;
        };
        /** @description Planning specification with its project, workflow state, content, and archive metadata. */
        Spec: components["schemas"]["ApiRecord"];
        /** @description Metadata for one specification attachment. */
        SpecAttachment: components["schemas"]["ApiRecord"];
        SpecAttachmentList: {
            attachments: components["schemas"]["SpecAttachment"][];
        };
        SpecInput: {
            description?: string;
            featureNumber?: number | null;
            links?: {
                label?: string;
                /** Format: uri */
                url: string;
            }[];
            title: string;
        };
        SpecList: {
            specs: components["schemas"]["Spec"][];
        };
        SpecPatch: {
            description?: string;
            featureNumber?: number | null;
            isPrimary?: boolean;
            links?: {
                label?: string;
                /** Format: uri */
                url: string;
            }[];
            title?: string;
        };
        StartConnectionBody: {
            /** @description Slack only: team (workspace) ID like T08B8C3E91N that pins Slack's authorize page to one workspace. An empty string or null leaves the workspace choice to Slack's picker. Omitted pins the organization's currently connected workspace so reconnects can't hop. */
            team?: string | null;
        };
        /** @description One formatted statistics card and its ordered chart points. */
        StatCard: {
            breakdown?: components["schemas"]["StatCardBreakdown"];
            /** @description Formatted change from the comparison period. */
            change: string;
            /** @description Window or comparison context. */
            context: string;
            /** @enum {string} */
            direction: "up" | "down" | "same";
            /** @description Stable metric key. */
            id: string;
            /** @description Human-readable card label. */
            name: string;
            /** @description Oldest-to-newest chart values. */
            points: number[];
            /** @description Formatted current value. */
            value: string;
        };
        StatCardBreakdown: {
            actionLabel: string;
            actionsPerParticipant: number;
            activeUsers: number;
            participatingUsers: number;
            participationRate: number;
            totalActions: number;
            windowDays: number;
        };
        StatEvent: {
            environment: string;
            id: string;
            name: string;
            /** Format: date-time */
            receivedAt: string;
            /** @enum {string} */
            status: "accepted" | "rejected";
            /** @description Truncated protected subject hash; never the original identifier. */
            subject: string;
            type: string;
        };
        StatEventList: components["schemas"]["StatEvent"][];
        /** @description Production statistics dashboard for one project. */
        StatsDashboard: {
            dateLabel: string;
            range: string;
            reportStatus: string;
            stats: components["schemas"]["StatCard"][];
        };
        TaskStage: {
            color: string;
            completed?: boolean;
            id: string;
            label: string;
        };
        TaskWorkflow: {
            owner: string;
            /** @enum {string} */
            source: "gtd-default" | "custom";
            stages: components["schemas"]["TaskStage"][];
            /** Format: date-time */
            updatedAt: string | null;
        };
        TaskWorkflowPut: {
            /** @description Defaults to the signed-in member and must match the signed-in member when provided. */
            owner?: string;
            /** @description Ordered personal columns. Exactly one stage must set completed to true. */
            stages: components["schemas"]["TaskStage"][];
        };
        TelemetryAction: {
            key: string;
            label: string;
            slot: number;
        };
        TelemetryActions: {
            actions: components["schemas"]["TelemetryAction"][];
            projectId: string;
            snippet: string;
            /** @enum {integer} */
            windowDays: 7 | 14 | 30;
        };
        TelemetryActivityEvent: {
            context?: components["schemas"]["JsonValue"];
            environment?: string;
            /** Format: uuid */
            eventId: string;
            idempotencyKey?: string;
            metric: string;
            /** Format: date-time */
            occurredAt?: string;
            /** @constant */
            type: "activity.occurred";
            /** @description SDK-generated HMAC pseudonym; raw application identifiers are rejected. */
            userId: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        TelemetryCardSelection: {
            cards: {
                cumulativeLabel?: string | null;
                dailyLabel?: string | null;
                /** @default true */
                enabled: boolean;
                metricKey: string;
                /** @default false */
                perActiveEnabled: boolean;
            }[];
        };
        TelemetryCustomFeatureInput: {
            /** @description Default user-impact text shown with the actual bounded technical error. */
            failureMessage: string;
            key: string;
            label: string;
        };
        TelemetryCustomFeatureUpdate: {
            enabled: boolean;
            failureMessage: string;
            label: string;
        };
        TelemetryCustomMetricInput: {
            key: string;
            label: string;
        };
        TelemetryCustomMetricUpdate: {
            /** @description Accept new events and include both derived outputs in reports. */
            enabled: boolean;
            label: string;
        };
        TelemetryError: {
            data?: {
                /** @description SDK-generated HMAC pseudonym; raw application identifiers are rejected. */
                affectedUser?: string;
                component?: string;
                environment?: string;
                errorCode?: string;
                /** @default false */
                fatal: boolean;
                fingerprint?: string;
                /** @default false */
                unhandled: boolean;
            };
            idempotencyKey?: string;
            message?: string;
            /** Format: date-time */
            occurredAt?: string;
            title: string;
            /** @constant */
            type: "error.occurred";
            /** Format: uri */
            url?: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        TelemetryFeatureResult: {
            context?: components["schemas"]["JsonValue"];
            durationMs?: number;
            environment?: string;
            error?: components["schemas"]["JsonValue"];
            /** Format: uuid */
            eventId?: string;
            feature: string;
            idempotencyKey?: string;
            message?: string;
            /** Format: date-time */
            occurredAt?: string;
            /** @enum {string} */
            outcome: "success" | "rejected" | "failure";
            reason?: string;
            /** @default false */
            test: boolean;
            /** @constant */
            type: "feature.result";
            /** @description Optional SDK-generated HMAC pseudonym. */
            userId?: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        TelemetryGitHubIssueSettingsUpdate: {
            /** @default false */
            commentOnRepeat: boolean;
            enabled: boolean;
            environments: ("production" | "staging" | "development" | "preview" | "test" | "local")[];
            projectId: string;
            /** @default 360 */
            repeatIntervalMinutes: number;
        };
        TelemetryIngestResponse: {
            /** @constant */
            accepted: true;
            duplicate?: boolean;
            eventId: string;
            notificationSuppressed?: boolean;
            period?: string;
            queued: boolean;
            stored: boolean;
        };
        TelemetryProjectMetricSelection: {
            enabledMetricKeys: ("users.new" | "users.total" | "users.active.daily" | "users.active.weekly" | "users.active.monthly" | "users.stickiness.dau_mau")[];
        };
        TelemetrySourceInput: {
            /** @default false */
            aggregateOnlySlack: boolean;
            /** @default true */
            alertsEnabled: boolean;
            allowedEvents?: string[];
            allowedOrigins?: string[];
            digestEnabled: boolean;
            digestTimeLocal: string;
            enabled: boolean;
            /**
             * @default production
             * @enum {string}
             */
            environment: "production" | "staging" | "development" | "preview" | "test" | "local";
            /** @default false */
            healthEnabled: boolean;
            /** Format: uri */
            healthUrl?: string | null;
            name: string;
            /**
             * @description May only be true for a production source.
             * @default false
             */
            productionStats: boolean;
            projectId: string | null;
            reportTitle?: string | null;
            /** @default 62 */
            retentionDays: number;
            slackChannelId: string | null;
            slackConnectionId: string | null;
            /** @description IANA timezone used for completed daily periods. */
            timezone: string;
        };
        TelemetryTrackedEvent: {
            attributes?: {
                [key: string]: string | number | boolean;
            };
            context?: components["schemas"]["JsonValue"];
            environment?: string;
            /** Format: uuid */
            eventId: string;
            idempotencyKey?: string;
            name: string;
            /** Format: date-time */
            occurredAt?: string;
            /** @constant */
            type: "activity.tracked";
            /** @description Required for trusted non-website events and forbidden for public browser events. */
            userId?: string;
            /** @default 1 */
            value: number;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        TelemetryUserEvent: {
            /** Format: date-time */
            occurredAt?: string;
            /** @enum {string} */
            type: "user.registered" | "user.active";
            /** @description SDK-generated HMAC pseudonym; raw application identifiers are rejected. */
            userId: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        UserAction: {
            provider: string;
            resume: Record<string, never>;
            /** @constant */
            status: "requires_user_action";
            userAction: {
                instructions: string;
                /** @constant */
                type: "open_url";
                /** Format: uri */
                url: string;
            };
        };
    };
    responses: {
        /** @description Organization administrator access is required */
        AdminRequired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["LegacyError"];
            };
        };
        /** @description Request payload exceeds the operation's documented size limit. */
        PayloadTooLarge: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiV1Error"];
            };
        };
        /** @description Request rate limit exceeded. Wait for the Retry-After delay before retrying. */
        RateLimited: {
            headers: {
                /** @description Seconds to wait before another request. */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiV1Error"];
            };
        };
        /** @description Missing, invalid, or expired supported credential */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["LegacyError"];
            };
        };
        /** @description Coded API v1 error */
        V1Error: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiV1Error"];
            };
        };
    };
    parameters: {
        actorId: string;
        attachmentId: number;
        connectionId: string;
        featureKey: string;
        /** @description ETag returned by the latest service config GET */
        ifMatch: string;
        keyId: string;
        metricKey: string;
        number: number;
        /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
        projectContext: string;
        projectId: string;
        provider: "github" | "slack";
        repo: string;
        service: "noxhere" | "planning" | "activity" | "feedback" | "telemetry";
        siteId: string;
        sourceId: string;
        specId: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    submitPublicFeedbackErrors: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackErrorBatch"];
            };
        };
        responses: {
            /** @description Errors queued */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Invalid error batch */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Origin is not enabled */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Delivery unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
        };
    };
    submitPublicFeedbackReport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackReport"];
            };
        };
        responses: {
            /** @description Capture queued */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Invalid capture */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Origin is not enabled */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Request body too large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Delivery unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
        };
    };
    reopenResolvedFeedbackReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque single-use reporter token from the resolution email. */
                token: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    response?: string;
                    /**
                     * Format: binary
                     * @description Optional PNG, JPEG, or WebP screenshot up to 7 MB.
                     */
                    screenshot?: string;
                };
            };
        };
        responses: {
            /** @description The original ticket was reopened. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            /** @description The response or screenshot is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            /** @description The response link is invalid, expired, or already used. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    getPublicFeedbackConfig: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                siteId: components["parameters"]["siteId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Effective public widget configuration */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Origin is not enabled */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Site not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
        };
    };
    getPublicFeedbackMembers: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                siteId: components["parameters"]["siteId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Origin-scoped reporter choices */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        members: {
                            /** Format: uri */
                            avatarUrl?: string | null;
                            login: string;
                        }[];
                    };
                };
            };
            /** @description Origin is not enabled */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
            /** @description Site not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyError"];
                };
            };
        };
    };
    getActivity: {
        parameters: {
            query?: {
                /** @description Feed event mode */
                mode?: "opened" | "merged" | "release-notes";
                /** @description Repository name */
                repo?: string;
                /** @description GitHub login */
                actor?: string;
                /** @description Maximum events */
                limit?: number;
                /** @description Composite cursor returned by the previous page */
                before?: string;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Activity response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityPage"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getCurrentWorkSummary: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getActivityDefaultPrompt: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listActors: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Actors */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getActor: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                actorId: components["parameters"]["actorId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Actor */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateActor: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                actorId: components["parameters"]["actorId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ActorPatch"];
            };
        };
        responses: {
            /** @description Actor updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listApiTokens: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createApiToken: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApiTokenCreate"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeApiToken: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    rotateApiToken: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    recordAppActivity: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    assignIssue: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeBrowserSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    pollNativeDeviceAuthorization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @constant */
                    client: "activity-mac";
                    device_code: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Authorization is still pending */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    startNativeDeviceAuthorization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @constant */
                    client: "activity-mac";
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Authorization is still pending */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    exchangeLegacyNativeCredential: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    access_token: string;
                    /** @constant */
                    client: "activity-mac";
                    refresh_token?: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Authorization is still pending */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    refreshNativeSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    refresh_token: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            /** @description Authorization is still pending */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    revokeNativeSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    refresh_token: string;
                };
            };
        };
        responses: {
            /** @description Session revoked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getIdentityProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getBootstrapStatus: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getWorkspaceConfig: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    putWorkspaceConfig: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    submitDeveloperFeedback: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeveloperFeedbackCreate"];
            };
        };
        responses: {
            /** @description Feedback received or previously received under the same idempotency key */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeveloperFeedbackReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    getEngineerActivity: {
        parameters: {
            query: {
                login: string;
                month?: string;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Engineer activity */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getEngineerStats: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listFeedEvents: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getFeedEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listFeatures: {
        parameters: {
            query?: {
                state?: string;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Features */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeatureList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    createFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeatureCreate"];
            };
        };
        responses: {
            /** @description Feature created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Feature"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            412: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    closeFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Feature closed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    updateFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeaturePatch"];
            };
        };
        responses: {
            /** @description Feature updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Feature"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    listFeatureAttachments: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpecAttachmentList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    uploadFeatureAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Attachment uploaded */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpecAttachment"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    downloadFeatureAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
                attachmentId: components["parameters"]["attachmentId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachment bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteFeatureAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                number: components["parameters"]["number"];
                attachmentId: components["parameters"]["attachmentId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachment deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getFeedbackProjectOverview: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateFeedbackReport: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                reportId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @default false */
                    notify?: boolean;
                    /** @default false */
                    retryNotification?: boolean;
                    /** @enum {string} */
                    status: "open" | "investigating" | "resolved";
                    summary?: string;
                };
            };
        };
        responses: {
            /** @description Report updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listFeedbackSites: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sites */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createFeedbackSite: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackSiteCreate"];
            };
        };
        responses: {
            /** @description Site created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteFeedbackSite: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: components["parameters"]["siteId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Site deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateFeedbackSite: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: components["parameters"]["siteId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackSitePatch"];
            };
        };
        responses: {
            /** @description Site updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getFeedbackResolutionTemplate: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Effective template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResolutionTemplateDocument"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateFeedbackResolutionTemplate: {
        parameters: {
            query?: never;
            header: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
                "If-Match": string;
            };
            path: {
                siteId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    template: components["schemas"]["FeedbackResolutionTemplate"] | null;
                };
            };
        };
        responses: {
            /** @description Saved template */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResolutionTemplateDocument"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            412: components["responses"]["V1Error"];
            428: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    previewFeedbackResolutionTemplate: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    template: components["schemas"]["FeedbackResolutionTemplate"];
                };
            };
        };
        responses: {
            /** @description Rendered preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    testFeedbackResolutionTemplate: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    recipient: string;
                    template: components["schemas"]["FeedbackResolutionTemplate"];
                };
            };
        };
        responses: {
            /** @description Postmark accepted the test email */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    retryFeedbackDeliveries: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                siteId: components["parameters"]["siteId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Eligible deliveries queued */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getGitHubComments: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getGitHubDetails: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getGitHubRateLimit: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listGuestAccess: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeGuestGrant: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                grantId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createGuestInvitation: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeGuestInvitation: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                inviteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listConnections: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Connection registry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    disconnectConnection: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                provider: components["parameters"]["provider"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disconnected */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    startConnection: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                provider: components["parameters"]["provider"];
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["StartConnectionBody"];
            };
        };
        responses: {
            /** @description Human action required */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAction"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getSetupPlan: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current setup plan */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SetupPlan"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    sendSlackMessage: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SlackMessageRequest"];
            };
        };
        responses: {
            /** @description Message sent */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SlackMessageDelivery"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            502: components["responses"]["V1Error"];
        };
    };
    getSlackRouting: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current routes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    patchSlackRouting: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoutingPatch"];
            };
        };
        responses: {
            /** @description Updated routes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    testSlackRoute: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteTest"];
            };
        };
        responses: {
            /** @description Test sent */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getIntegrationStatus: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    setIssueState: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listIssues: {
        parameters: {
            query?: {
                /** @description Issue state filter */
                state?: string;
                /** @description Repository name */
                repo?: string;
                /** @description Page number */
                page?: number;
                /** @description Results per page */
                page_size?: number;
                /** @description Sort field */
                sort?: string;
                /** @description Sort direction */
                sort_dir?: "asc" | "desc";
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Issues and aggregate metrics */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordCollection"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getIssue: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                repo: components["parameters"]["repo"];
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Issue */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getAiSettings: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description AI settings without credentials */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    putAiSettings: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    mode: "disabled" | "managed";
                };
            };
        };
        responses: {
            /** @description AI settings saved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    getCurrentMember: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listMembers: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listOperationFailures: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getOperatorUsage: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    draftPlanningItem: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanningAssistRequest"];
            };
        };
        responses: {
            /** @description A draft that must be explicitly accepted before creation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanningAssistResponse"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            502: components["responses"]["V1Error"];
            503: components["responses"]["V1Error"];
        };
    };
    listProjects: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Projects */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createProject: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getProjectRouting: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project routing model */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getProjectActivity: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    archiveProject: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project archived */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    restoreProject: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project restored */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    backfillProjectPullRequests: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    getProjectFeedback: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getProjectIncidents: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectIncidentOverview"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getProjectIncident: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
                incidentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectIncidentResponse"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateProjectIncident: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
                incidentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectIncidentUpdate"];
            };
        };
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectIncidentResponse"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getProjectIssues: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    retrieveProject: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateProjectRouting: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectRoutingInput"];
            };
        };
        responses: {
            /** @description Project routing updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectActions: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TelemetryActions"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryProjectActions: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApiRecord"];
            };
        };
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TelemetryActions"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectAlertRules: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentAlertRuleList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectAlerts: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncidentAlertList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectDashboard: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatsDashboard"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectStatEvents: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatEventList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listPullRequests: {
        parameters: {
            query?: {
                /** @description Pull-request state filter */
                state?: string;
                /** @description GitHub author login */
                author?: string;
                /** @description Repository name */
                repo?: string;
                /** @description Page number */
                page?: number;
                /** @description Results per page */
                page_size?: number;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Pull requests and aggregate metrics */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordCollection"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    closePullRequest: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    number: number;
                    repo: string;
                };
            };
        };
        responses: {
            /** @description Pull request closed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getPullRequest: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                repo: components["parameters"]["repo"];
                number: components["parameters"]["number"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Pull request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    recoverRepositoryHistory: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listRepositories: {
        parameters: {
            query?: {
                include?: "all";
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Repositories */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    acknowledgeRepositories: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    repos: string[];
                };
            };
        };
        responses: {
            /** @description Repositories acknowledged */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    searchWorkspace: {
        parameters: {
            query?: {
                /** @description Included words; quote a phrase to keep it together. */
                q?: string;
                /** @description Comma-separated tools. */
                tools?: string;
                /** @description Comma-separated kinds. */
                kinds?: string;
                /** @description Comma-separated repos. */
                repos?: string;
                /** @description Comma-separated assignees. */
                assignees?: string;
                /** @description Comma-separated statuses. */
                statuses?: string;
                /** @description Comma-separated tags. */
                tags?: string;
                /** @description Comma-separated exclude. */
                exclude?: string;
                /** @description Earliest updated date, inclusive. */
                from?: string;
                /** @description Latest updated date, inclusive. */
                to?: string;
                limit?: number;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listNoxServices: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Capability-first service catalog for the current organization */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceCatalog"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getNoxService: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                service: components["parameters"]["service"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One service and its capability-first setup model */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceDetail"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getNoxServiceConfig: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                service: components["parameters"]["service"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service-scoped configuration */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceConfig"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    patchNoxServiceConfig: {
        parameters: {
            query?: never;
            header: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
                /** @description ETag returned by the latest service config GET */
                "If-Match": components["parameters"]["ifMatch"];
            };
            path: {
                service: components["parameters"]["service"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServiceConfigPatch"];
            };
        };
        responses: {
            /** @description Updated service configuration */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceConfig"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            412: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            428: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getNoxServiceHealth: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                service: components["parameters"]["service"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current service health */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceHealth"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getNoxServiceSetup: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                service: components["parameters"]["service"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service-scoped setup model */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceSetupDetail"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listSlackChannels: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Slack channels */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    assignSlackConnectionProject: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                connectionId: components["parameters"]["connectionId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SlackProjectAssignment"];
            };
        };
        responses: {
            /** @description Assignment saved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    disconnectSlackWorkspace: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getSlackStatus: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    testSlackDestination: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listSpecs: {
        parameters: {
            query?: {
                featureNumber?: string;
                include?: "all";
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Specifications */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpecList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createSpec: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SpecInput"];
            };
        };
        responses: {
            /** @description Specification created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Spec"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getSpec: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Specification */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Spec"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateSpec: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SpecPatch"];
            };
        };
        responses: {
            /** @description Specification updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Spec"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    archiveSpec: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Specification archived */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    restoreSpec: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Specification restored */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listSpecAttachments: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpecAttachmentList"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    uploadSpecAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Attachment uploaded */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpecAttachment"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    downloadSpecAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
                attachmentId: components["parameters"]["attachmentId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachment bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteSpecAttachment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                specId: components["parameters"]["specId"];
                attachmentId: components["parameters"]["attachmentId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attachment deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getSyncStatus: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    syncGitHubData: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    syncGitHubEvents: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getPersonalTaskWorkflow: {
        parameters: {
            query?: {
                /** @description GitHub login whose personal task workflow should be returned. Defaults to the signed-in member. */
                owner?: string;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Personal task workflow */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskWorkflow"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    putPersonalTaskWorkflow: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskWorkflowPut"];
            };
        };
        responses: {
            /** @description Personal task workflow replaced */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskWorkflow"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    listPlanningTasks: {
        parameters: {
            query?: {
                owner?: string;
                status?: "open" | "completed" | "all";
                featureNumber?: number | "general";
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Planning tasks */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanningTask"][];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    createPlanningTask: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanningTaskCreate"];
            };
        };
        responses: {
            /** @description Planning task created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanningTask"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    deletePlanningTask: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Planning task deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MutationReceipt"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    updatePlanningTask: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanningTaskPatch"];
            };
        };
        responses: {
            /** @description Planning task updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanningTask"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            422: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["V1Error"];
        };
    };
    listGitHubTeams: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryErrorStatus: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: string;
                fingerprint: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "open" | "acknowledged" | "resolved";
                };
            };
        };
        responses: {
            /** @description Error incident status updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetryEvents: {
        parameters: {
            query?: {
                /** @description Optional source filter */
                sourceId?: string;
                /** @description Maximum recent events */
                limit?: number;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Recent events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryGitHubIssueSettings: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project incident settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    putTelemetryGitHubIssueSettings: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryGitHubIssueSettingsUpdate"];
            };
        };
        responses: {
            /** @description Project incident settings updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryDailyHealth: {
        parameters: {
            query: {
                sourceId: string;
            };
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Daily user health */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectOverview: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    getTelemetryProjectMetrics: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project metric settings and readiness */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryProjectMetrics: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                projectId: components["parameters"]["projectId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryProjectMetricSelection"];
            };
        };
        responses: {
            /** @description Project metric settings updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    ingestTelemetryEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryUserEvent"] | components["schemas"]["TelemetryError"] | components["schemas"]["TelemetryFeatureResult"] | components["schemas"]["TelemetryActivityEvent"] | components["schemas"]["TelemetryTrackedEvent"];
            };
        };
        responses: {
            /** @description Event accepted and deduplicated */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TelemetryIngestResponse"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetrySources: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sources */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createTelemetrySource: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetrySourceInput"];
            };
        };
        responses: {
            /** @description Source created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetrySource: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetrySourceInput"];
            };
        };
        responses: {
            /** @description Source updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteTelemetrySource: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Source deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetryCards: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Configured report cards */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryCards: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryCardSelection"];
            };
        };
        responses: {
            /** @description Cards updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetryCustomMetrics: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Custom metric catalog */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createTelemetryCustomMetric: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryCustomMetricInput"];
            };
        };
        responses: {
            /** @description Metric registered */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryCustomMetric: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                metricKey: components["parameters"]["metricKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryCustomMetricUpdate"];
            };
        };
        responses: {
            /** @description Metric updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteTelemetryCustomMetric: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                metricKey: components["parameters"]["metricKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Metric deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetryFeatures: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Feature catalog and current health */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createTelemetryCustomFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryCustomFeatureInput"];
            };
        };
        responses: {
            /** @description Feature registered */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    updateTelemetryCustomFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                featureKey: components["parameters"]["featureKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelemetryCustomFeatureUpdate"];
            };
        };
        responses: {
            /** @description Feature updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    deleteTelemetryCustomFeature: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                featureKey: components["parameters"]["featureKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Feature deleted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    testTelemetrySource: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["JsonValue"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    listTelemetryKeys: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Key lifecycle metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    createTelemetryKey: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    kind: "publishable" | "secret";
                    name: string;
                };
            };
        };
        responses: {
            /** @description Key created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    revokeTelemetryKey: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                keyId: components["parameters"]["keyId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Key revoked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
    rotateTelemetryKey: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional project selector inside the authenticated organization. Omit it for organization-wide data. When supplied, it must match any project identifier in the URL and the project bound to an API token. */
                "X-Project-ID"?: components["parameters"]["projectContext"];
            };
            path: {
                sourceId: components["parameters"]["sourceId"];
                keyId: components["parameters"]["keyId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Replacement key shown once */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JsonValue"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["RateLimited"];
        };
    };
}
