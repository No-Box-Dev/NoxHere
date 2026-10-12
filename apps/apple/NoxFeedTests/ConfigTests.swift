import XCTest
@testable import NoxFeed

final class ConfigTests: XCTestCase {
    func testAIProviderSettingsURLIncludesOrganisationAndDestination() throws {
        let url = Config.aiProviderSettingsURL(org: "No Box/Dev")
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value) })

        XCTAssertEqual(components.scheme, "https")
        XCTAssertEqual(components.host, "app.noxhere.com")
        XCTAssertEqual(query["org"], "No Box/Dev")
        XCTAssertEqual(query["tab"], "settings")
        XCTAssertEqual(query["focus"], "aiProvider")
    }

    func testOnboardingWebPagesUseSecureGitHubURLs() {
        XCTAssertEqual(Config.githubAppInstallURL.scheme, "https")
        XCTAssertEqual(Config.githubAppInstallURL.host, "github.com")
        XCTAssertEqual(Config.githubOrganizationsURL.scheme, "https")
        XCTAssertEqual(Config.githubOrganizationsURL.host, "github.com")
    }
}
