import XCTest
@testable import NoxHere

final class NotifierStoreTests: XCTestCase {
    func testEventCheckpointDoesNotSkipUnprocessedBurstItems() {
        XCTAssertEqual(
            NotificationDeliveryProgress.eventCheckpoint(
                previous: 100,
                processed: [101, 102, 103, 104, 105]
            ),
            105
        )
    }

    func testIssueBurstLeavesUndeliveredItemsUnseenForNextTick() {
        let retained = NotificationDeliveryProgress.retainedSeen(
            current: Array(1...8),
            previouslySeen: Set([1, 2]),
            delivered: [3, 4, 5, 6, 7]
        )

        XCTAssertEqual(retained, Array(1...7))
        XCTAssertFalse(retained.contains(8))
    }

    func testClosedItemsDropFromSeenSetSoReassignmentCanNotifyAgain() {
        let retained = NotificationDeliveryProgress.retainedSeen(
            current: ["repo#2"],
            previouslySeen: Set(["repo#1", "repo#2"]),
            delivered: []
        )

        XCTAssertEqual(retained, ["repo#2"])
    }
}
