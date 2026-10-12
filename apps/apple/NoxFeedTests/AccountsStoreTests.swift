import XCTest
@testable import NoxFeed

final class AccountsStoreTests: XCTestCase {
    func testKeychainWriteFailureExplainsRecovery() {
        let error = AccountsStore.StoreError.keychainWriteFailed

        XCTAssertEqual(
            error.errorDescription,
            "GitHub approved the sign-in, but NoxHere couldn't save it securely in your Mac Keychain. Please reopen NoxHere and try again."
        )
    }
}
