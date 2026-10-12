import XCTest
@testable import NoxFeed

final class APIClientTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.handler = nil
        super.tearDown()
    }

    func testWorkerHTMLFailureIsNeverShownToTheUser() {
        let error = APIError.status(500, "<!DOCTYPE html><title>Worker threw exception</title>")

        XCTAssertEqual(
            error.errorDescription,
            "NoxConnect couldn't load this view (HTTP 500). Select Retry. If it keeps happening, check NoxConnect service status."
        )
        XCTAssertFalse(error.errorDescription?.contains("<html") ?? true)
    }

    func testJSONAPIErrorKeepsItsUsefulMessage() {
        let error = APIError.status(422, #"{"error":"Choose an enabled repository and try again."}"#)

        XCTAssertEqual(
            error.errorDescription,
            "Request failed (HTTP 422): Choose an enabled repository and try again."
        )
    }

    func testNestedConfigConflictKeepsItsUsefulMessage() {
        let error = APIError.status(
            412,
            #"{"error":{"code":"revision_conflict","message":"Configuration changed. Reload and try again."}}"#
        )

        XCTAssertEqual(
            error.errorDescription,
            "Request failed (HTTP 412): Configuration changed. Reload and try again."
        )
    }

    func testDecodingErrorIdentifiesTheIncompatibleField() throws {
        struct RequiredValue: Decodable { let required: String }
        do {
            _ = try JSONDecoder().decode(RequiredValue.self, from: Data(#"{}"#.utf8))
            XCTFail("Expected decoding to fail")
        } catch {
            XCTAssertEqual(
                APIError.decoding(error).errorDescription,
                "NoxConnect returned an incompatible response (missing required)."
            )
        }
    }

    @MainActor
    func testMissingServiceConfigFunctionHasAnActionableError() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/services/noxconnect/config")
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data("<!doctype html><title>NoxConnect</title>".utf8)
            )
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        do {
            _ = try await client.fetchNoxConnectServiceConfig()
            XCTFail("Expected the missing server capability to fail")
        } catch APIError.capabilityUnavailable {
            XCTAssertEqual(
                APIError.capabilityUnavailable.errorDescription,
                "NoxConnect management is not available on the connected server yet."
            )
        }
    }

    @MainActor
    func testReleaseNotesEditorLoadsCanonicalNoxConnectDefault() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/noxfeed/release-notes-prompt")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "acme")
            let data = Data(#"{"prompt":"Write the standard structured release note."}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.fetchReleaseNotesPromptDefault()

        XCTAssertEqual(response.prompt, "Write the standard structured release note.")
    }

    @MainActor
    func testExpiredSessionFailsAfterOneRefreshAttempt() async throws {
        var requestCount = 0
        var refreshCount = 0
        StubURLProtocol.handler = { request in
            requestCount += 1
            return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }
        let client = APIClient(
            token: { "expired-token" },
            org: "acme",
            refresh: {
                refreshCount += 1
                return false
            },
            session: Self.session()
        )

        do {
            _ = try await client.fetchIntegrationOverview()
            XCTFail("Expected an expired session error")
        } catch APIError.unauthorized {
            XCTAssertEqual(requestCount, 1)
            XCTAssertEqual(refreshCount, 1)
        }
    }

    @MainActor
    func testRetryKeepsOriginalOrgAndUsesRefreshedToken() async throws {
        var token = "old-token"
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            let status = requests.count == 1 ? 401 : 200
            return (HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, Data("[]".utf8))
        }

        let client = APIClient(
            token: { token },
            org: "original-org",
            refresh: {
                token = "refreshed-token"
                return true
            },
            session: Self.session()
        )

        _ = try await client.fetchMembers()

        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "X-Org"), "original-org")
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "X-Org"), "original-org")
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer old-token")
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "Authorization"), "Bearer refreshed-token")
    }

    @MainActor
    func testMissingAccessTokenRefreshesBeforeFirstRequest() async throws {
        var token: String?
        var refreshCount = 0
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            let data = Data(#"{"user":{"login":"jasper","avatar_url":null},"orgs":[]}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        let client = APIClient(
            token: { token },
            refresh: {
                refreshCount += 1
                token = "recovered-token"
                return true
            },
            session: Self.session()
        )

        let profile = try await client.fetchGitHubProfile()

        XCTAssertEqual(profile.user.login, "jasper")
        XCTAssertEqual(refreshCount, 1)
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer recovered-token")
    }

    @MainActor
    func testRecentEventPaginationReachesWatermark() async throws {
        var requestCount = 0
        StubURLProtocol.handler = { request in
            requestCount += 1
            let before = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "before" })?.value
            let ids = before == nil ? Array((301...500).reversed()) : [300, 275, 250, 200]
            let next: String? = before == nil ? "page-2" : nil
            let body: [String: Any] = [
                "events": ids.map(Self.eventJSON),
                "nextCursor": next.map { $0 as Any } ?? NSNull(),
            ]
            guard let data = try? JSONSerialization.data(withJSONObject: body) else {
                return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
            }
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "org", session: Self.session())

        let firstPage = try await client.fetchRecentEvents(limit: 200)
        let events = try await client.fetchRecentEvents(after: 250, startingWith: firstPage)

        XCTAssertEqual(requestCount, 2)
        XCTAssertEqual(events.count, 202)
        XCTAssertEqual(events.map(\.id).min(), 275)
        XCTAssertEqual(events.map(\.id).max(), 500)
    }

    @MainActor
    func testOpenPullRequestsPageUntilTheCompleteLargeOrganizationSetIsLoaded() async throws {
        var requestedPages: [String] = []
        StubURLProtocol.handler = { request in
            let page = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "page" })?.value ?? ""
            requestedPages.append(page)
            let ids = page == "1" ? [1, 2] : [3]
            let body: [String: Any] = [
                "data": ids.map { ["id": $0] },
                "totalCount": 3,
                "page": Int(page) ?? 1,
                "pageSize": 2,
            ]
            let data = try! JSONSerialization.data(withJSONObject: body)
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                data
            )
        }
        let client = APIClient(token: { "token" }, org: "large-org", session: Self.session())

        let pullRequests = try await client.fetchOpenPRs(limit: 2)

        XCTAssertEqual(requestedPages, ["1", "2"])
        XCTAssertEqual(pullRequests.map(\.id), [1, 2, 3])
    }

    @MainActor
    func testNoxConnectStatusDecodesInstallationState() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/integrations/status")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "example-org")
            let data = Data(#"{"github":{"connected":true,"bootstrapping":false}}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "example-org", session: Self.session())

        let status = try await client.fetchNoxConnectStatus()

        XCTAssertTrue(status.github.connected)
    }

    @MainActor
    func testAppActivityUsesAuthenticatedNoxFeedIdentity() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/v1/app-activity")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "example-org")
            XCTAssertEqual(Self.bodyData(from: request), Data(#"{"app":"noxfeed"}"#.utf8))
            return (HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!, Data())
        }
        let client = APIClient(token: { "token" }, org: "example-org", session: Self.session())

        try await client.recordAppActivity()
    }

    @MainActor
    func testPRCommentsUseNoxConnectGitHubFacade() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/github/comments")
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
            XCTAssertEqual(query.first(where: { $0.name == "repo" })?.value, "web")
            XCTAssertEqual(query.first(where: { $0.name == "number" })?.value, "42")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "acme")
            let data = Data(#"{"comments":[{"id":"review_comment:7","kind":"review_comment","body":"Rename this","author_login":"ada","created_at":"2026-08-30T01:00:00Z","updated_at":"2026-08-30T01:00:00Z","path":"src/app.ts","line":12}],"truncated":false}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let page = try await client.fetchGitHubPRComments(repo: "web", number: 42)

        XCTAssertEqual(page.comments.count, 1)
        XCTAssertEqual(page.comments.first?.kind, .reviewComment)
        XCTAssertEqual(page.comments.first?.path, "src/app.ts")
        XCTAssertFalse(page.truncated)
    }

    @MainActor
    func testPRDetailsDecodeDescriptionAndSummary() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/github/details")
            let data = Data(#"{"body":"Ships the menu","comments":2,"review_comments":1,"additions":20,"deletions":4,"changed_files":3,"merged":false,"mergeable":true}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let details = try await client.fetchGitHubPRDetails(repo: "web", number: 42)

        XCTAssertEqual(details.body, "Ships the menu")
        XCTAssertEqual(details.comments + details.reviewComments, 3)
        XCTAssertEqual(details.changedFiles, 3)
    }

    @MainActor
    func testOpenNoxTicketFeaturesDecodeOwnersAndStatus() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/features")
            XCTAssertEqual(request.url?.query, "state=open")
            let data = Data(#"[{"id":7,"number":42,"title":"Ship reports","assignees":[{"login":"jasper"}],"labels":[{"name":"noxticket"},{"name":"feature"},{"name":"status:staging"}],"html_url":"https://github.com/acme/noxconnect/issues/42","updated_at":"2026-09-02T01:00:00Z"}]"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let features = try await client.fetchOpenNoxTicketFeaturesIfEnabled()

        XCTAssertEqual(features?.first?.owners, ["jasper"])
        XCTAssertEqual(features?.first?.status, "staging")
        XCTAssertEqual(features?.first?.number, 42)
        XCTAssertFalse(features?.first?.isBacklog ?? true)
    }

    @MainActor
    func testGlobalSearchUsesOneEncodedOrganizationScopedRequest() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/search")
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
            XCTAssertEqual(query.first(where: { $0.name == "q" })?.value, "login flow #17")
            XCTAssertEqual(query.first(where: { $0.name == "limit" })?.value, "40")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "acme")
            let data = Data(#"{"query":"login flow #17","results":[{"id":"pr:17","kind":"pull_request","title":"Login flow","subtitle":"mac #17 · jasper","repo":"mac","number":17,"state":"open","url":"https://github.com/acme/mac/pull/17","avatarUrl":null,"createdAt":"2026-09-03T00:00:00Z","score":524}]}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.fetchGlobalSearch(query: "login flow #17")

        XCTAssertEqual(response.results.first?.kind, .pullRequest)
        XCTAssertEqual(response.results.first?.number, 17)
    }

    func testNoxTicketFeatureRecognizesBacklogLabel() throws {
        let data = Data(#"{"id":8,"number":43,"title":"Later","assignees":[{"login":"jasper"}],"labels":[{"name":"feature"},{"name":"BACKLOG"}]}"#.utf8)

        let feature = try JSONDecoder().decode(NoxTicketFeature.self, from: data)

        XCTAssertTrue(feature.isBacklog)
    }

    func testIssueDecodesTriageFields() throws {
        let data = Data(#"{"id":7,"repo":"mac","number":42,"title":"Fix the picker","state":"open","assignees":[{"login":"jasper","avatar_url":"https://example.com/avatar.png"}],"labels":[{"name":"critical","color":"ff0000"}],"created_at":"2026-09-01T00:00:00Z","updated_at":"2026-09-14T00:00:00Z","closed_at":null,"html_url":"https://github.com/acme/mac/issues/42"}"#.utf8)

        let issue = try JSONDecoder().decode(Issue.self, from: data)

        XCTAssertEqual(issue.assignedPeople.first?.login, "jasper")
        XCTAssertTrue(issue.isCritical)
        XCTAssertEqual(issue.state, "open")
    }

    @MainActor
    func testIssuesTabRequestsRepositoryAndClosedWindow() async throws {
        StubURLProtocol.handler = { request in
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
            XCTAssertEqual(request.url?.path, "/api/v1/issues")
            XCTAssertEqual(query.first(where: { $0.name == "state" })?.value, "closed")
            XCTAssertEqual(query.first(where: { $0.name == "repos" })?.value, "noxfeed")
            XCTAssertNotNil(query.first(where: { $0.name == "closed_since" })?.value)
            XCTAssertEqual(query.first(where: { $0.name == "sort" })?.value, "updated_at")
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(#"{"data":[],"totalCount":0,"page":1,"pageSize":100}"#.utf8)
            )
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let issues = try await client.fetchIssues(
            state: "closed",
            repository: "noxfeed",
            closedSince: Date(timeIntervalSince1970: 0)
        )

        XCTAssertTrue(issues.isEmpty)
    }

    @MainActor
    func testDisabledNoxTicketReturnsNoFeatureSection() async throws {
        StubURLProtocol.handler = { request in
            let data = Data(#"{"error":"NoxTicket is turned off","code":"service_disabled"}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 403, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let features = try await client.fetchOpenNoxTicketFeaturesIfEnabled()

        XCTAssertNil(features)
    }

    @MainActor
    func testDemoClientUsesIsolatedAPIBase() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.host, "demo.example")
            XCTAssertEqual(request.url?.path, "/api/v1/actors")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer demo-token")
            let data = Data(#"{"actors":[]}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(
            baseURL: URL(string: "https://demo.example")!,
            token: { "demo-token" },
            org: "NoxFeed-Demo",
            session: Self.session()
        )

        let actors = try await client.fetchActors()

        XCTAssertTrue(actors.isEmpty)
    }

    func testDemoSessionDecodesIdentity() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/demo/session")
            let data = Data(#"{"access_token":"demo-token","expires_in":86400,"account":{"login":"reviewer-demo","name":"NoxFeed Reviewer","avatar_url":null},"organization":{"id":1,"login":"NoxFeed-Demo","avatar_url":null},"mode":"demo","read_only":true}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        let demo = try await DemoSessionService.start(
            baseURL: URL(string: "https://demo.example")!,
            session: Self.session()
        )

        XCTAssertEqual(demo.account.login, "reviewer-demo")
        XCTAssertEqual(demo.organization.login, "NoxFeed-Demo")
    }

    @MainActor
    func testNoxFeedConfigPatchUsesRevisionAndOnlyRequestedField() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            XCTAssertEqual(request.url?.path, "/api/v1/services/noxfeed/config")
            XCTAssertEqual(request.value(forHTTPHeaderField: "If-Match"), "\"revision-1\"")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "acme")
            let body = try? JSONSerialization.jsonObject(with: Self.bodyData(from: request) ?? Data()) as? [String: Any]
            XCTAssertEqual(body?["releaseNotesPrompt"] as? String, "Keep it concise")
            XCTAssertEqual(body?.count, 1)
            let data = Data(#"{"revision":"revision-2","configuration":{"writable":true,"writableFields":["releaseNotesPrompt"]},"config":{"releaseNotesPrompt":"Keep it concise"}}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let updated = try await client.patchNoxFeedServiceConfig(
            revision: "revision-1",
            fields: ["releaseNotesPrompt": .string("Keep it concise")]
        )

        XCTAssertEqual(updated.revision, "revision-2")
        XCTAssertEqual(updated.config.releaseNotesPrompt, "Keep it concise")
    }

    @MainActor
    func testIntegrationOverviewDecodesPermissionsAndConnectionHealth() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/integrations/connections")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "acme")
            let data = Data(#"{"canConfigure":false,"setup":{"ready":true,"needsOnboarding":false},"github":{"connected":true,"bootstrapping":false,"health":"healthy","lastEventAt":"2026-09-05T01:00:00Z","manageUrl":"https://github.com/settings/installations/1","installUrl":null},"slack":{"connected":true,"configured":true,"needsReconnect":false,"teamName":"Acme","health":"healthy","channels":{"noxFeedPosts":"C123","noxFeedReleaseNotes":null}}}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let overview = try await client.fetchIntegrationOverview()

        XCTAssertFalse(overview.canConfigure)
        XCTAssertTrue(overview.setup.ready)
        XCTAssertEqual(overview.github.health, "healthy")
        XCTAssertEqual(overview.slack.teamName, "Acme")
        XCTAssertEqual(overview.slack.channels.noxFeedPosts, "C123")
    }

    @MainActor
    func testSlackRoutingPatchCannotEraseUnrelatedSettings() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            XCTAssertEqual(request.url?.path, "/api/v1/integrations/slack/routing")
            let body = try? JSONSerialization.jsonObject(with: Self.bodyData(from: request) ?? Data()) as? [String: Any]
            let routes = body?["routes"] as? [String: Any]
            let connections = body?["connections"] as? [String: Any]
            XCTAssertEqual(routes?["noxfeed_posts"] as? String, "C123")
            XCTAssertEqual(routes?.count, 1)
            XCTAssertEqual(connections?["noxfeed_posts"] as? String, "conn-feed")
            XCTAssertEqual(connections?.count, 1)
            let data = Data(#"{"routes":{"fallback":null,"noxfeed_posts":"C123","noxfeed_release_notes":null},"connections":{"fallback":null,"noxfeed_posts":"conn-feed","noxfeed_release_notes":null}}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.patchSlackRoute(
            name: "noxfeed_posts",
            channelId: "C123",
            connectionId: "conn-feed"
        )

        XCTAssertEqual(response.routes["noxfeed_posts"] ?? nil, "C123")
        XCTAssertEqual(response.connections?["noxfeed_posts"] ?? nil, "conn-feed")
    }

    @MainActor
    func testSlackChannelsAreFetchedForTheSelectedNoxConnectWorkspace() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/api/v1/slack/channels")
            XCTAssertEqual(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "conn-feed")
            let data = Data(#"{"connectionId":"conn-feed","channels":[{"id":"C1","name":"engineering","is_private":false,"is_archived":false,"is_member":true}]}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.fetchSlackChannels(connectionId: "conn-feed")

        XCTAssertEqual(response.connectionId, "conn-feed")
        XCTAssertEqual(response.channels.first?.name, "engineering")
    }

    @MainActor
    func testHistoryBackfillUsesTheCanonicalNoxConnectProjectEndpoint() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/api/v1/projects/project-1/backfill-prs")
            let body = try? JSONSerialization.jsonObject(with: Self.bodyData(from: request) ?? Data()) as? [String: Any]
            XCTAssertEqual(body?["days"] as? Int, 7)
            XCTAssertEqual(body?["rewriteOtherModels"] as? Bool, true)
            let data = Data(#"{"ok":true,"found":4,"queued":3,"skipped":1,"renarrated":2,"days":7}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.backfillProjectPRs(id: "project-1", days: 7, rewriteOtherModels: true)

        XCTAssertEqual(response.queued, 3)
        XCTAssertEqual(response.renarrated, 2)
    }

    @MainActor
    func testNoxConnectPolicyPatchIsScopedAndRevisionProtected() async throws {
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            XCTAssertEqual(request.url?.path, "/api/v1/services/noxconnect/config")
            XCTAssertEqual(request.value(forHTTPHeaderField: "If-Match"), "\"revision-7\"")
            let body = try? JSONSerialization.jsonObject(with: Self.bodyData(from: request) ?? Data()) as? [String: Any]
            XCTAssertEqual(body?["newRepositoryPolicy"] as? String, "exclude")
            XCTAssertEqual(body?.count, 1)
            let data = Data(#"{"revision":"revision-8","config":{"enabledServices":{"noxticket":true,"noxfeed":true,"noxspot":true,"noxcue":true},"newRepositoryPolicy":"exclude"}}"#.utf8)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        let client = APIClient(token: { "token" }, org: "acme", session: Self.session())

        let response = try await client.patchNoxConnectServiceConfig(
            revision: "revision-7",
            fields: ["newRepositoryPolicy": .string("exclude")]
        )

        XCTAssertEqual(response.config.newRepositoryPolicy, "exclude")
        XCTAssertTrue(response.config.enabledServices.noxfeed)
    }

    private static func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }

    private static func bodyData(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }

    private static func eventJSON(_ id: Int) -> [String: Any] {
        [
            "id": id,
            "type": "github:pr:opened",
            "summary": "PR \(id)",
            "created_at": "2026-08-14T00:00:00Z",
            "payload_json": NSNull(),
        ]
    }
}

final class StubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let handler = Self.handler else {
            XCTFail("Missing URL handler")
            return
        }
        let (response, data) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
