import XCTest
@testable import NoxFeed

@MainActor
final class CurrentMembersStoreTests: XCTestCase {
    func testDuplicateLoadsForTheSameScopeAreCoalesced() async {
        let store = CurrentMembersStore()
        let scope = CurrentMembersStore.Scope(login: "jasper", org: "n1healthcare")
        var memberCalls = 0
        let operations = operations(members: {
            memberCalls += 1
            try? await Task.sleep(for: .milliseconds(50))
            return [.init(login: "jasper", avatarUrl: nil)]
        })

        let first = Task { await store.load(scope: scope, operations: operations) }
        try? await Task.sleep(for: .milliseconds(5))
        let second = Task { await store.load(scope: scope, operations: operations) }
        await first.value
        await second.value

        XCTAssertEqual(memberCalls, 1)
        XCTAssertEqual(store.members.map(\.login), ["jasper"])
    }

    func testNewScopeCannotBeOverwrittenBySlowOldRequest() async {
        let store = CurrentMembersStore()
        let oldLoad = Task {
            await store.load(
                scope: .init(login: "jasper", org: "old-org"),
                operations: operations(members: {
                    try? await Task.sleep(for: .milliseconds(100))
                    return [.init(login: "old-member", avatarUrl: nil)]
                })
            )
        }
        try? await Task.sleep(for: .milliseconds(10))

        await store.load(
            scope: .init(login: "jasper", org: "new-org"),
            operations: operations(members: { [.init(login: "new-member", avatarUrl: nil)] })
        )
        await oldLoad.value

        XCTAssertEqual(store.members.map(\.login), ["new-member"])
        XCTAssertNil(store.errorMessage)
    }

    func testFailedStatsRefreshPreservesLastKnownCounts() async {
        let store = CurrentMembersStore()
        let scope = CurrentMembersStore.Scope(login: "jasper", org: "n1healthcare")
        await store.load(
            scope: scope,
            operations: operations(
                members: { [.init(login: "jasper", avatarUrl: nil)] },
                stats: { Self.stats(openPRs: 7) }
            )
        )

        await store.load(
            scope: scope,
            operations: operations(
                members: { [.init(login: "jasper", avatarUrl: nil)] },
                stats: { throw APIError.status(422, #"{"error":"bad stats"}"#) }
            )
        )

        XCTAssertEqual(store.stats?.prCount("jasper"), 7)
        XCTAssertTrue(store.errorMessage?.contains("bad stats") == true)
    }

    func testRetryClassificationIsLimitedToTransientFailures() {
        XCTAssertTrue(CurrentMembersStore.isRetryable(APIError.network(URLError(.timedOut))))
        XCTAssertTrue(CurrentMembersStore.isRetryable(APIError.status(503, nil)))
        XCTAssertTrue(CurrentMembersStore.isRetryable(APIError.status(429, nil)))
        XCTAssertFalse(CurrentMembersStore.isRetryable(APIError.unauthorized))
        XCTAssertFalse(CurrentMembersStore.isRetryable(APIError.status(403, nil)))
        XCTAssertFalse(CurrentMembersStore.isRetryable(APIError.decoding(DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "bad")))))
    }

    func testTransientMemberFailureIsRetriedOnce() async {
        let store = CurrentMembersStore()
        var memberCalls = 0

        await store.load(
            scope: .init(login: "jasper", org: "n1healthcare"),
            operations: operations(members: {
                memberCalls += 1
                if memberCalls == 1 { throw APIError.status(503, nil) }
                return [.init(login: "jasper", avatarUrl: nil)]
            })
        )

        XCTAssertEqual(memberCalls, 2)
        XCTAssertEqual(store.members.map(\.login), ["jasper"])
        XCTAssertNil(store.errorMessage)
    }

    private func operations(
        members: @escaping () async throws -> [APIClient.OrgMember],
        stats: @escaping () async throws -> APIClient.EngineerStats = { CurrentMembersStoreTests.stats(openPRs: 1) },
        exclusions: @escaping () async throws -> Set<String> = { [] }
    ) -> CurrentMembersStore.Operations {
        .init(members: members, stats: stats, excludedMembers: exclusions)
    }

    private static func stats(openPRs: Int) -> APIClient.EngineerStats {
        .init(
            openPRs: ["jasper": openPRs],
            openNonDraftPRs: ["jasper": openPRs],
            reviewing: ["jasper": 2],
            assignedIssues: ["jasper": 3]
        )
    }
}
