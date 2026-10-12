import LocalAuthentication
import Security
import XCTest
@testable import NoxFeed

final class KeychainTests: XCTestCase {
    func testCurrentQueriesUseDataProtectionKeychain() {
        let query = Keychain.query(account: "gh_access:jasper", returnData: true)

        XCTAssertEqual(query[kSecUseDataProtectionKeychain as String] as? Bool, true)
        XCTAssertEqual(query[kSecAttrService as String] as? String, "dev.noboxdev.noxfeed")
        XCTAssertEqual(query[kSecAttrAccount as String] as? String, "gh_access:jasper")
        XCTAssertEqual(query[kSecReturnData as String] as? Bool, true)
    }

    func testLegacyMigrationQueriesDisallowAuthenticationUI() throws {
        let query = Keychain.query(
            account: "gh_access_token",
            returnData: true,
            dataProtection: false,
            suppressInteraction: true
        )

        XCTAssertNil(query[kSecUseDataProtectionKeychain as String])
        let context = try XCTUnwrap(query[kSecUseAuthenticationContext as String] as? LAContext)
        XCTAssertTrue(context.interactionNotAllowed)
    }
}
