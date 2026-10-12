import XCTest
@testable import NoxFeed

final class FeedEventTests: XCTestCase {
    func testFeedNavigationIncludesIssuesAfterNotes() {
        XCTAssertEqual(FeedMode.allCases.map(\.label), ["Current", "Opened", "Merged", "Notes", "Issues"])
    }

    func testOnlyTimelineModesUseTheFeedPoller() {
        XCTAssertFalse(FeedMode.current.usesFeedStore)
        XCTAssertFalse(FeedMode.issues.usesFeedStore)
        XCTAssertTrue(FeedMode.opened.usesFeedStore)
        XCTAssertTrue(FeedMode.posts.usesFeedStore)
        XCTAssertTrue(FeedMode.releaseNotes.usesFeedStore)
    }

    func testInvalidTimestampFailsDecoding() throws {
        let data = Data(#"{"id":1,"type":"github:pr:opened","summary":"x","created_at":"not-a-date"}"#.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(FeedEvent.self, from: data))
    }

    func testFractionalTimestampDecodes() throws {
        let data = Data(#"{"id":1,"type":"github:pr:opened","summary":"x","created_at":"2026-08-14T01:02:03.456Z"}"#.utf8)
        let event = try JSONDecoder().decode(FeedEvent.self, from: data)
        XCTAssertEqual(event.id, 1)
    }
}
