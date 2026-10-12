import XCTest
@testable import NoxHere

final class FeedStoreTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.handler = nil
        super.tearDown()
    }

    @MainActor
    func testSearchPagingUsesLargeBatchAndStopsAtPartialPage() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let before = query.first(where: { $0.name == "before" })?.value
            let ids = before == nil ? Array(1...25) : [25, 26]
            let body: [String: Any] = [
                "events": ids.map { Self.eventJSON($0) },
                "nextCursor": before == nil ? "older-page" : NSNull(),
            ]
            let data = try! JSONSerialization.data(withJSONObject: body)
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                data
            )
        }

        let session = URLSession(configuration: {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubURLProtocol.self]
            return configuration
        }())
        let client = APIClient(
            baseURL: URL(string: "https://search.example")!,
            token: { "token" },
            org: "acme",
            session: session
        )
        let store = FeedStore()
        await store.attach(clientProvider: { client }, cache: TimelineCache())

        XCTAssertTrue(store.canLoadMore)
        await store.loadMore(limit: 200)
        store.stopPolling()

        XCTAssertEqual(requests.count, 2)
        let secondQuery = URLComponents(url: requests[1].url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
        XCTAssertEqual(secondQuery.first(where: { $0.name == "before" })?.value, "older-page")
        XCTAssertEqual(secondQuery.first(where: { $0.name == "limit" })?.value, "200")
        XCTAssertEqual(store.events.map(\.id), Array(1...26).map(Int64.init))
        XCTAssertFalse(store.canLoadMore)
    }

    @MainActor
    func testPollingReplacesChangedRowsAndPreservesLoadedHistory() async throws {
        var requestCount = 0
        StubURLProtocol.handler = { request in
            requestCount += 1
            let events: [[String: Any]]
            if requestCount == 1 {
                events = [Self.eventJSON(2, summary: "Old title"), Self.eventJSON(1)]
            } else {
                events = [Self.eventJSON(3), Self.eventJSON(2, summary: "Updated title")]
            }
            let data = try! JSONSerialization.data(withJSONObject: [
                "events": events,
                "nextCursor": NSNull(),
            ])
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                data
            )
        }

        let session = URLSession(configuration: {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubURLProtocol.self]
            return configuration
        }())
        let client = APIClient(
            baseURL: URL(string: "https://poll.example")!,
            token: { "token" },
            org: "acme",
            session: session
        )
        let store = FeedStore()
        await store.attach(clientProvider: { client }, cache: TimelineCache())
        XCTAssertEqual(store.events.map(\.id), [2, 1])

        let pollSucceeded = await store.pollOnce()
        XCTAssertTrue(pollSucceeded)
        store.stopPolling()

        XCTAssertEqual(store.events.map(\.id), [3, 2, 1])
        XCTAssertEqual(store.events.first(where: { $0.id == 2 })?.summary, "Updated title")
    }

    @MainActor
    func testManualRefreshAlwaysRevalidatesAndUpdatesTheVisibleRow() async throws {
        var requestCount = 0
        StubURLProtocol.handler = { request in
            requestCount += 1
            let summary = requestCount == 1 ? "Before refresh" : "After refresh"
            let data = try! JSONSerialization.data(withJSONObject: [
                "events": [Self.eventJSON(1, summary: summary)],
                "nextCursor": NSNull(),
            ])
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                data
            )
        }

        let session = URLSession(configuration: {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubURLProtocol.self]
            return configuration
        }())
        let client = APIClient(
            baseURL: URL(string: "https://refresh.example")!,
            token: { "token" },
            org: "acme",
            session: session
        )
        let store = FeedStore()
        await store.attach(clientProvider: { client }, cache: TimelineCache())

        await store.refreshNow()

        XCTAssertEqual(requestCount, 2)
        XCTAssertEqual(store.events.first?.summary, "After refresh")
        XCTAssertFalse(store.isRefreshing)
    }

    @MainActor
    func testMergedPullRequestsAreRemovedFromCurrentWork() throws {
        let data = Data(#"""
        [
            {"id":1,"author":"jasper","state":"open"},
            {"id":2,"author":"jasper","state":"closed"},
            {"id":3,"author":"jasper","state":"open","merged_at":"2026-09-16T12:00:00Z"},
            {"id":4,"author":"someone-else","state":"open"}
        ]
        """#.utf8)
        let pullRequests = try JSONDecoder().decode([PullRequest].self, from: data)

        let current = MeStore.currentPullRequests(from: pullRequests, login: "jasper")

        XCTAssertEqual(current.map(\.id), [1])
    }

    private static func eventJSON(_ id: Int, summary: String? = nil) -> [String: Any] {
        [
            "id": id,
            "type": "narrative",
            "summary": summary ?? "Event \(id)",
            "created_at": "2026-09-03T00:00:00Z",
            "payload_json": NSNull(),
        ]
    }
}
