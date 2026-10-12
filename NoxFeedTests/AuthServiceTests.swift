import XCTest
@testable import NoxFeed

@MainActor
final class AuthServiceTests: XCTestCase {
    func testTerminalRefreshResponsesRequireSignOut() {
        for statusCode in [400, 401, 403, 410] {
            XCTAssertTrue(
                AuthService.refreshResponseRequiresSignOut(statusCode),
                "Expected HTTP \(statusCode) to invalidate the local session"
            )
        }
    }

    func testTemporaryRefreshFailuresRemainRetryable() {
        for statusCode in [404, 408, 429, 500, 502, 503] {
            XCTAssertFalse(
                AuthService.refreshResponseRequiresSignOut(statusCode),
                "Expected HTTP \(statusCode) to preserve the local session"
            )
        }
    }
}
