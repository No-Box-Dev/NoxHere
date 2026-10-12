import XCTest
@testable import NoxHere

final class FeedProjectTests: XCTestCase {
    func testTrackedRepositoryRequiresActiveRecordWithRepo() {
        XCTAssertTrue(project(repo: "noxhere-mac").isTrackedRepository)
        XCTAssertFalse(project(repo: "noxhere-mac", archived: 1).isTrackedRepository)
        XCTAssertFalse(project(repo: nil).isTrackedRepository)
        XCTAssertFalse(project(repo: "   ").isTrackedRepository)
    }

    func testRepositoryDisplayNameUsesRepoInsteadOfProductSlug() {
        XCTAssertEqual(
            project(name: "NoxHere", slug: "noxhere", repo: "noxhere-mac").repositoryDisplayName,
            "noxhere-mac"
        )
    }

    private func project(
        name: String = "NoxHere",
        slug: String? = "noxhere",
        repo: String?,
        archived: Int? = 0
    ) -> FeedProject {
        FeedProject(
            id: "project-1",
            name: name,
            slug: slug,
            repo: repo,
            archived: archived
        )
    }
}
