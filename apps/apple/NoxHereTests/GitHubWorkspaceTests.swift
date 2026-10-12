import XCTest
@testable import NoxHere

final class GitHubWorkspaceTests: XCTestCase {
    func testWorkspacesIncludePersonalBeforeSortedOrganizations() {
        let workspaces = GitHubWorkspaceSelection.workspaces(
            login: "jasper",
            organizations: ["Zebra", "acme"]
        )

        XCTAssertEqual(workspaces.map(\.login), ["jasper", "acme", "Zebra"])
        XCTAssertEqual(workspaces.map(\.kind), [.personal, .organization, .organization])
        XCTAssertEqual(workspaces.first?.displayName, "Personal · @jasper")
    }

    func testExistingOrganizationSelectionIsPreserved() {
        XCTAssertEqual(
            GitHubWorkspaceSelection.resolvedSelection(
                current: "acme",
                login: "jasper",
                organizations: ["acme"]
            ),
            "acme"
        )
    }

    func testPersonalSelectionIsPreserved() {
        XCTAssertEqual(
            GitHubWorkspaceSelection.resolvedSelection(
                current: "JASPER",
                login: "jasper",
                organizations: ["acme"]
            ),
            "JASPER"
        )
    }

    func testOrganizationRemainsDefaultForExistingUsers() {
        XCTAssertEqual(
            GitHubWorkspaceSelection.resolvedSelection(
                current: nil,
                login: "jasper",
                organizations: ["zeta", "acme"]
            ),
            "acme"
        )
    }

    func testPersonalIsFallbackWithoutOrganizations() {
        XCTAssertEqual(
            GitHubWorkspaceSelection.resolvedSelection(
                current: nil,
                login: "jasper",
                organizations: []
            ),
            "jasper"
        )
    }
}
