import XCTest
@testable import NoxFeed

final class FeedProjectTests: XCTestCase {
    func testTrackedRepositoryRequiresActiveRecordWithRepo() {
        XCTAssertTrue(project(repo: "noxfeed-mac").isTrackedRepository)
        XCTAssertFalse(project(repo: "noxfeed-mac", archived: 1).isTrackedRepository)
        XCTAssertFalse(project(repo: nil).isTrackedRepository)
        XCTAssertFalse(project(repo: "   ").isTrackedRepository)
    }

    func testRepositoryDisplayNameUsesRepoInsteadOfProductSlug() {
        XCTAssertEqual(
            project(name: "NoxFeed", slug: "noxfeed", repo: "noxfeed-mac").repositoryDisplayName,
            "noxfeed-mac"
        )
    }

    private func project(
        name: String = "NoxFeed",
        slug: String? = "noxfeed",
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
