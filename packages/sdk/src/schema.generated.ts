export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface paths {
    "/api/spots/public/v1/errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit a bounded batch of automatic browser errors */
        post: operations["submitPublicNoxSpotErrors"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/spots/public/v1/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a public NoxSpot capture
         * @description Submit feedback from an origin-bound widget. NoxSpot cannot inspect a host website's login session: the host must explicitly pass its signed-in user through NoxSpot.identify(...) or NoxSpot.init({ getReporter }). reporterEmail is retained for resolution mail only when notifyOnResolution is true. An optional HTTPS reporterAvatarUrl is retained as private report metadata and is never copied into GitHub.
         */
        post: operations["submitPublicNoxSpotReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/spots/public/v1/resolution-responses/{token}": {
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
         * @description Consumes the single-use token from a NoxSpot resolution email, adds an optional response and screenshot to the original GitHub issue, and reopens the issue.
         */
        post: operations["reopenResolvedNoxSpotReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/spots/public/v1/sites/{siteId}/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get effective public widget configuration for the request origin */
        get: operations["getPublicNoxSpotConfig"];
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
        /** List organization people and identity overlays */
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
        /** Get one organization identity */
        get: operations["getActor"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update an organization identity overlay */
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
         * @description NoxConnect completes the GitHub exchange server-side and returns its own short-lived access and rotating refresh credentials.
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
         * @description Returns an opaque NoxConnect device handle plus the GitHub verification URI and user code.
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
         * @description Temporary one-time migration route for older NoxFeed releases. Normal sign-in uses the brokered device flow.
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
    "/api/v1/cues/errors/{sourceId}/{fingerprint}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update an error incident status
         * @description Acknowledge, resolve, or reopen one NoxCue error group in the optional project context.
         */
        put: operations["updateNoxCueErrorStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent NoxCue events and Slack delivery state */
        get: operations["listNoxCueEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/github-issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List project GitHub-incident settings
         * @description Returns each active project's repository mapping, routing policy, and open NoxCue incident count.
         */
        get: operations["getNoxCueGitHubIssueSettings"];
        /**
         * Update project GitHub-incident settings
         * @description Controls whether NoxCue opens or updates a GitHub issue for incidents in the selected project and environments.
         */
        put: operations["putNoxCueGitHubIssueSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get stored NoxCue-derived user metrics and digest state */
        get: operations["getNoxCueDailyHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/project-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a guest-safe NoxCue project overview
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getNoxCueProjectOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/projects/{projectId}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List selectable metrics and their active event status for one project */
        get: operations["getNoxCueProjectMetrics"];
        /** Choose metrics included in one project's daily report */
        put: operations["updateNoxCueProjectMetrics"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/public/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit one standardized NoxCue event through the stable NoxConnect gateway
         * @description Authenticated by X-Nox-Ingest-Key. Supply eventId or idempotencyKey when retrying error and feature events. User lifecycle facts are intrinsically deduplicated by source, user, type, and period.
         */
        post: operations["ingestNoxCueEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List NoxCue sources, linked projects, and ingest keys */
        get: operations["listNoxCueSources"];
        put?: never;
        /** Create a NoxCue event source */
        post: operations["createNoxCueSource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a NoxCue event source */
        put: operations["updateNoxCueSource"];
        post?: never;
        /** Delete a NoxCue source and revoke its keys */
        delete: operations["deleteNoxCueSource"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/custom-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List registered custom activity metrics and event status */
        get: operations["listNoxCueCustomMetrics"];
        put?: never;
        /** Register a custom activity metric before ingest */
        post: operations["createNoxCueCustomMetric"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/custom-metrics/{metricKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Rename or pause a registered custom activity metric */
        put: operations["updateNoxCueCustomMetric"];
        post?: never;
        /** Delete a custom metric definition while retaining historical events */
        delete: operations["deleteNoxCueCustomMetric"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/features": {
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
        get: operations["listNoxCueFeatures"];
        put?: never;
        /** Register a custom NoxCue feature before ingest */
        post: operations["createNoxCueCustomFeature"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/features/{featureKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update or pause a registered custom feature */
        put: operations["updateNoxCueCustomFeature"];
        post?: never;
        /** Delete a custom feature definition while retaining historical results */
        delete: operations["deleteNoxCueCustomFeature"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/health/test": {
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
         * Test a NoxCue source destination
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["testNoxCueSource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create a one-time NoxCue browser or server ingest key
         * @description The key value is returned once. Do not log it.
         */
        post: operations["createNoxCueKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cues/sources/{sourceId}/keys/{keyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke a NoxCue ingest key */
        delete: operations["revokeNoxCueKey"];
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
        /** Get normalized monthly activity for one engineer */
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
         * List detailed NoxFeed events
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
         * Read one detailed NoxFeed event
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
        /** List NoxTicket features */
        get: operations["listFeatures"];
        put?: never;
        /** Create a feature */
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
        /** Close a feature */
        delete: operations["closeFeature"];
        options?: never;
        head?: never;
        /** Partially update a feature */
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
        /** List feature attachments */
        get: operations["listFeatureAttachments"];
        put?: never;
        /** Upload a bounded feature attachment */
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
        /** Download a feature attachment */
        get: operations["downloadFeatureAttachment"];
        put?: never;
        post?: never;
        /** Delete a feature attachment */
        delete: operations["deleteFeatureAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get normalized current work, posts, and release notes */
        get: operations["getNoxFeed"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feed/current-summary": {
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
        /** List provider connection state */
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
        /** Disconnect a provider */
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
        /** Get resumable setup state and next actions */
        get: operations["getSetupPlan"];
        put?: never;
        post?: never;
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
        /** Get service-to-channel routing */
        get: operations["getSlackRouting"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Partially update service-to-channel routing */
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
        /** Send a test message through a saved or candidate route */
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
        /** List tracked GitHub issues */
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
        /** Get one tracked GitHub issue */
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
        /** Get organization AI execution settings */
        get: operations["getAiSettings"];
        /** Set organization AI execution mode */
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
         * Read membership and NoxConnect role for the current organization
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
    "/api/v1/noxfeed/release-notes-prompt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the server-owned NoxFeed release-notes prompt
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getNoxFeedDefaultPrompt"];
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
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active projects used by feature setup */
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
        /** List NoxConnect projects, repository assignments, and product destinations */
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
        /** Read project activity */
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
        /** Stop tracking a project without deleting it */
        post: operations["archiveProject"];
        /** Resume tracking an eligible project */
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
         * Queue bounded NoxFeed pull-request history
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        post: operations["backfillProjectPullRequests"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/cue/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read project Cue actions */
        get: operations["getCueProjectActions"];
        /** Update project Cue actions */
        put: operations["updateCueProjectActions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/cue/alert-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read project Cue alert rules */
        get: operations["getCueProjectAlertRules"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/cue/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read project Cue alerts */
        get: operations["getCueProjectAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/cue/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the project Cue dashboard */
        get: operations["getCueProjectDashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/cue/stat-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read project Cue statistic events */
        get: operations["getCueProjectStatEvents"];
        put?: never;
        post?: never;
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
        /** Read project feedback */
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
        /** Read project incidents */
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
        /** Read one project incident */
        get: operations["getProjectIncident"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update one project incident */
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
        /** Read project issues */
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
        /** Atomically update one project's repositories and named Slack destinations */
        put: operations["updateProjectRouting"];
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
        /** List tracked pull requests */
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
        /** Close a pull request through GitHub */
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
        /** Get one tracked pull request */
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
        /** List tracked repositories or include all discovered repositories */
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
        /** Acknowledge newly discovered repositories */
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
        /** List Nox services, their focus, capabilities, and setup readiness */
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
        /** Get capabilities and setup readiness for one Nox service */
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
        /** Get service readiness and connection checks */
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
        /** Get setup state, sections, blockers, and capabilities for one service */
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
        /** List channels visible to the connected Nox bot */
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
         * Assign a Slack workspace to a project
         * @description One workspace may be organization-wide. With multiple workspaces, every connection requires a project.
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
        /** List NoxTicket specifications */
        get: operations["listSpecs"];
        put?: never;
        /** Create a specification */
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
        /** Get one specification */
        get: operations["getSpec"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Partially update or relink a specification */
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
        /** Archive a specification */
        post: operations["archiveSpec"];
        /** Restore a specification */
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
        /** List specification attachments */
        get: operations["listSpecAttachments"];
        put?: never;
        /** Upload a bounded specification attachment */
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
        /** Download a specification attachment */
        get: operations["downloadSpecAttachment"];
        put?: never;
        post?: never;
        /** Delete a specification attachment */
        delete: operations["deleteSpecAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/spots/project-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a guest-safe NoxSpot project overview
         * @description Canonical first-party client operation. Its established success payload remains compatible while all failures use the API v1 error envelope.
         */
        get: operations["getNoxSpotProjectOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/spots/reports/{reportId}": {
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
         * Update a NoxSpot report status
         * @description Mark a report open, investigating, or resolved and optionally send or retry the reporter's consented resolution email.
         */
        patch: operations["updateNoxSpotReport"];
        trace?: never;
    };
    "/api/v1/spots/sites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List NoxSpot sites */
        get: operations["listNoxSpotSites"];
        put?: never;
        /** Create a NoxSpot site */
        post: operations["createNoxSpotSite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/spots/sites/{siteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a NoxSpot site and its screenshots */
        delete: operations["deleteNoxSpotSite"];
        options?: never;
        head?: never;
        /** Update a NoxSpot site including its channel override */
        patch: operations["updateNoxSpotSite"];
        trace?: never;
    };
    "/api/v1/spots/sites/{siteId}/resolution-template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the effective NoxSpot resolution email template
         * @description Returns the site's custom content and appearance or the NoxConnect default plus a revision for conditional updates. Organization admins and project-scoped API tokens can use the same endpoint.
         */
        get: operations["getNoxSpotResolutionTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update or reset a NoxSpot resolution email template
         * @description Send the revision returned by GET as If-Match. Set template to null to restore the default. This is the self-service configuration used by the NoxConnect UI and is also available to project-scoped API tokens. Postmark is transport-only; NoxConnect validates, renders, and snapshots the template used for each resolution.
         */
        patch: operations["updateNoxSpotResolutionTemplate"];
        trace?: never;
    };
    "/api/v1/spots/sites/{siteId}/resolution-template/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Render a safe preview of a draft resolution email template */
        post: operations["previewNoxSpotResolutionTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/spots/sites/{siteId}/resolution-template/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a draft resolution email through NoxConnect and Postmark
         * @description The draft does not need to be saved. NoxConnect renders the safe email and sends it through its private Postmark-backed email capability.
         */
        post: operations["testNoxSpotResolutionTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/spots/sites/{siteId}/retry-deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry blocked deliveries for one NoxSpot site */
        post: operations["retryNoxSpotDeliveries"];
        delete?: never;
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
                    noxconnect: components["schemas"]["ManagedAiServiceStatus"];
                    noxfeed: components["schemas"]["ManagedAiServiceStatus"];
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
            /** @description One enabled NoxConnect project. The token cannot access resources assigned to another project. */
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
        /** @description NoxTicket feature mirrored from its GitHub issue, including number, title, workflow status, owners, labels, and project. */
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
        NoxConnectConfigPatch: {
            enabledServices?: {
                noxcue?: boolean;
                noxfeed?: boolean;
                noxspot?: boolean;
                noxticket?: boolean;
            };
            /** @enum {string} */
            newRepositoryPolicy?: "include" | "exclude";
        };
        NoxCueActivityEvent: {
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
            /** @description Stable app identifier; NoxCue stores only a source-scoped hash. */
            userId: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        NoxCueCustomFeatureInput: {
            /** @description Default user-impact text shown with the actual bounded technical error. */
            failureMessage: string;
            key: string;
            label: string;
        };
        NoxCueCustomFeatureUpdate: {
            enabled: boolean;
            failureMessage: string;
            label: string;
        };
        NoxCueCustomMetricInput: {
            key: string;
            label: string;
        };
        NoxCueCustomMetricUpdate: {
            /** @description Accept new events and include both derived outputs in reports. */
            enabled: boolean;
            label: string;
        };
        NoxCueError: {
            data?: {
                /** @description Opaque identifier; NoxCue stores only a source-scoped hash. */
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
        NoxCueFeatureResult: {
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
            /** @description Optional actor identity. NoxCue stores only a source-scoped hash; browser identity never contributes to authoritative active-user totals. */
            userId?: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        NoxCueGitHubIssueSettingsUpdate: {
            /** @default false */
            commentOnRepeat: boolean;
            enabled: boolean;
            environments: ("production" | "staging" | "development" | "preview" | "test" | "local")[];
            projectId: string;
            /** @default 360 */
            repeatIntervalMinutes: number;
        };
        NoxCueIngestResponse: {
            /** @constant */
            accepted: true;
            duplicate?: boolean;
            eventId: string;
            notificationSuppressed?: boolean;
            period?: string;
            queued: boolean;
            stored: boolean;
        };
        NoxCueProjectMetricSelection: {
            enabledMetricKeys: ("users.new" | "users.total" | "users.active.daily" | "users.active.weekly" | "users.active.monthly" | "users.stickiness.dau_mau")[];
        };
        NoxCueSourceInput: {
            allowedOrigins?: string[];
            digestEnabled: boolean;
            digestTimeLocal: string;
            enabled: boolean;
            /** @default false */
            healthEnabled: boolean;
            /** Format: uri */
            healthUrl?: string | null;
            name: string;
            projectId: string | null;
            slackChannelId: string | null;
            slackConnectionId: string | null;
            /** @description IANA timezone used for completed daily periods. */
            timezone: string;
        };
        NoxCueUserEvent: {
            /** Format: date-time */
            occurredAt?: string;
            /** @enum {string} */
            type: "user.registered" | "user.active";
            /** @description Stable app identifier; NoxCue stores only a source-scoped SHA-256 hash. */
            userId: string;
            /**
             * @default 1
             * @constant
             */
            version: 1;
        };
        NoxFeedConfigPatch: {
            releaseNotesPrompt?: string | null;
        };
        NoxService: {
            capabilities: components["schemas"]["ServiceCapability"][];
            description: string;
            enabled: boolean;
            focus: string;
            /** @enum {string} */
            id: "noxconnect" | "noxticket" | "noxfeed" | "noxspot" | "noxcue";
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
        NoxSpotBlock: {
            environments?: string[];
            id: string;
            label?: string | null;
            options?: string[];
            required?: boolean;
            /** @enum {string} */
            type: "title" | "description" | "reporter" | "contact_email" | "custom_text" | "custom_textarea" | "custom_select" | "element_picker" | "metadata" | "console_logs";
        };
        NoxSpotEnvironment: {
            buttonColor?: string | null;
            buttonText?: string | null;
            enabled?: boolean;
            name: string;
            url: string;
            /** @enum {string|null} */
            widgetMode?: "development" | "release" | null;
        };
        NoxSpotErrorBatch: {
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
        NoxSpotReport: {
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
        /** @description Site-level content and brand presentation for NoxSpot resolution emails. Every site can configure this in NoxConnect or with a project-scoped API token. Only {{report_title}} and {{site_name}} placeholders are accepted. NoxConnect owns the evidence rules, AI safety prompt, safe HTML rendering, verified sender address, and reopen behavior. */
        NoxSpotResolutionTemplate: {
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
        NoxSpotResolutionTemplateDocument: {
            defaults: components["schemas"]["NoxSpotResolutionTemplate"];
            revision: string;
            template: components["schemas"]["NoxSpotResolutionTemplate"];
            usingDefault: boolean;
        };
        NoxSpotSiteCreate: {
            autoErrorLogging?: boolean;
            buttonColor?: string;
            buttonText?: string;
            name: string;
            projectId: string;
            /** @enum {string} */
            widgetMode?: "development" | "release";
        };
        NoxSpotSitePatch: {
            autoErrorLogging?: boolean;
            blocks?: components["schemas"]["NoxSpotBlock"][];
            buttonColor?: string;
            buttonText?: string;
            environments?: components["schemas"]["NoxSpotEnvironment"][];
            slackChannelId?: string | null;
            slackConnectionId?: string | null;
            /** @enum {string} */
            widgetMode?: "development" | "release";
        };
        NoxTicketConfigPatch: {
            featureRepository?: string | null;
            workflow?: {
                stages: {
                    color: string;
                    id: string;
                    label: string;
                }[];
            };
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
        ProjectDestination: {
            channelId: string;
            connectionId: string;
        };
        ProjectRoutingInput: {
            /** @description Whether this repository-mirror row is explicitly enabled as a NoxConnect routing project */
            enabled: boolean;
            repositories: string[];
            routes: {
                noxCue: components["schemas"]["ProjectDestination"];
                noxCueAlerts: components["schemas"]["ProjectDestination"];
                noxfeedPosts: components["schemas"]["ProjectDestination"];
                noxfeedReleaseNotes: components["schemas"]["ProjectDestination"];
            };
        };
        /** @enum {string} */
        ProviderConnectionState: "ready" | "connecting" | "disconnected" | "degraded" | "unavailable";
        RecordCollection: components["schemas"]["ApiRecord"][] | components["schemas"]["PaginatedRecords"] | components["schemas"]["ApiRecord"];
        RouteTest: {
            /** @description Optional candidate channel; otherwise uses saved routing and fallback. */
            channelId?: string;
            /** @enum {string} */
            route: "fallback" | "noxcue" | "noxticket" | "noxfeed_posts" | "noxfeed_release_notes";
        };
        RoutingPatch: {
            routes: {
                fallback?: string | null;
                noxcue?: string | null;
                noxfeed_posts?: string | null;
                noxfeed_release_notes?: string | null;
                noxticket?: string | null;
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
            /** @description Shape depends on service. NoxSpot and NoxCue configuration is resource-scoped and linked from links.resources. */
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
        ServiceConfigPatch: components["schemas"]["NoxConnectConfigPatch"] | components["schemas"]["NoxTicketConfigPatch"] | components["schemas"]["NoxFeedConfigPatch"] | Record<string, never>;
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
        ServiceId: "noxconnect" | "noxticket" | "noxfeed" | "noxspot" | "noxcue";
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
        SlackProjectAssignment: {
            /** @description Project to own this workspace. Null is allowed only while it is the organization's sole workspace. */
            projectId: string | null;
        };
        /** @description NoxTicket specification with its project, workflow state, content, and archive metadata. */
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
        service: "noxconnect" | "noxticket" | "noxfeed" | "noxspot" | "noxcue";
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
    submitPublicNoxSpotErrors: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoxSpotErrorBatch"];
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
    submitPublicNoxSpotReport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoxSpotReport"];
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
    reopenResolvedNoxSpotReport: {
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
    getPublicNoxSpotConfig: {
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
                    client: "noxfeed-mac";
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
            429: components["responses"]["V1Error"];
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
                    client: "noxfeed-mac";
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
            429: components["responses"]["V1Error"];
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
                    client: "noxfeed-mac";
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxCueErrorStatus: {
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
            429: components["responses"]["V1Error"];
        };
    };
    listNoxCueEvents: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxCueGitHubIssueSettings: {
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
            429: components["responses"]["V1Error"];
        };
    };
    putNoxCueGitHubIssueSettings: {
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
                "application/json": components["schemas"]["NoxCueGitHubIssueSettingsUpdate"];
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxCueDailyHealth: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxCueProjectOverview: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxCueProjectMetrics: {
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxCueProjectMetrics: {
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
                "application/json": components["schemas"]["NoxCueProjectMetricSelection"];
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
            429: components["responses"]["V1Error"];
        };
    };
    ingestNoxCueEvent: {
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
                "application/json": components["schemas"]["NoxCueUserEvent"] | components["schemas"]["NoxCueError"] | components["schemas"]["NoxCueFeatureResult"] | components["schemas"]["NoxCueActivityEvent"];
            };
        };
        responses: {
            /** @description Event accepted and deduplicated */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoxCueIngestResponse"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            413: components["responses"]["V1Error"];
            415: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
        };
    };
    listNoxCueSources: {
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
            429: components["responses"]["V1Error"];
        };
    };
    createNoxCueSource: {
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
                "application/json": components["schemas"]["NoxCueSourceInput"];
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxCueSource: {
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
                "application/json": components["schemas"]["NoxCueSourceInput"];
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
            429: components["responses"]["V1Error"];
        };
    };
    deleteNoxCueSource: {
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
            429: components["responses"]["V1Error"];
        };
    };
    listNoxCueCustomMetrics: {
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
            429: components["responses"]["V1Error"];
        };
    };
    createNoxCueCustomMetric: {
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
                "application/json": components["schemas"]["NoxCueCustomMetricInput"];
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxCueCustomMetric: {
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
                "application/json": components["schemas"]["NoxCueCustomMetricUpdate"];
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
            429: components["responses"]["V1Error"];
        };
    };
    deleteNoxCueCustomMetric: {
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
            429: components["responses"]["V1Error"];
        };
    };
    listNoxCueFeatures: {
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
            429: components["responses"]["V1Error"];
        };
    };
    createNoxCueCustomFeature: {
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
                "application/json": components["schemas"]["NoxCueCustomFeatureInput"];
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxCueCustomFeature: {
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
                "application/json": components["schemas"]["NoxCueCustomFeatureUpdate"];
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
            429: components["responses"]["V1Error"];
        };
    };
    deleteNoxCueCustomFeature: {
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
            429: components["responses"]["V1Error"];
        };
    };
    testNoxCueSource: {
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
            429: components["responses"]["V1Error"];
        };
    };
    createNoxCueKey: {
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
            429: components["responses"]["V1Error"];
        };
    };
    revokeNoxCueKey: {
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            413: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxFeed: {
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
            /** @description NoxFeed response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedPage"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxFeedDefaultPrompt: {
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
            503: components["responses"]["V1Error"];
        };
    };
    getCueProjectActions: {
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
            429: components["responses"]["V1Error"];
        };
    };
    updateCueProjectActions: {
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
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
        };
    };
    getCueProjectAlertRules: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getCueProjectAlerts: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getCueProjectDashboard: {
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
            429: components["responses"]["V1Error"];
        };
    };
    getCueProjectStatEvents: {
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
                    "application/json": components["schemas"]["ApiRecord"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            404: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            413: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxSpotProjectOverview: {
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxSpotReport: {
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
            429: components["responses"]["V1Error"];
        };
    };
    listNoxSpotSites: {
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
            429: components["responses"]["V1Error"];
        };
    };
    createNoxSpotSite: {
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
                "application/json": components["schemas"]["NoxSpotSiteCreate"];
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
            429: components["responses"]["V1Error"];
        };
    };
    deleteNoxSpotSite: {
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
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxSpotSite: {
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
                "application/json": components["schemas"]["NoxSpotSitePatch"];
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
            429: components["responses"]["V1Error"];
        };
    };
    getNoxSpotResolutionTemplate: {
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
                    "application/json": components["schemas"]["NoxSpotResolutionTemplateDocument"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
        };
    };
    updateNoxSpotResolutionTemplate: {
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
                    template: components["schemas"]["NoxSpotResolutionTemplate"] | null;
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
                    "application/json": components["schemas"]["NoxSpotResolutionTemplateDocument"];
                };
            };
            400: components["responses"]["V1Error"];
            401: components["responses"]["V1Error"];
            403: components["responses"]["V1Error"];
            409: components["responses"]["V1Error"];
            412: components["responses"]["V1Error"];
            428: components["responses"]["V1Error"];
            429: components["responses"]["V1Error"];
        };
    };
    previewNoxSpotResolutionTemplate: {
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
                    template: components["schemas"]["NoxSpotResolutionTemplate"];
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
            429: components["responses"]["V1Error"];
        };
    };
    testNoxSpotResolutionTemplate: {
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
                    template: components["schemas"]["NoxSpotResolutionTemplate"];
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
            429: components["responses"]["V1Error"];
            503: components["responses"]["V1Error"];
        };
    };
    retryNoxSpotDeliveries: {
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
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
            429: components["responses"]["V1Error"];
        };
    };
}
