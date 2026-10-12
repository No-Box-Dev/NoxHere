import Foundation

/// Everything after `id` is optional — the D1 row occasionally has NULLs for
/// state / author / title on partially-synced records, and one nil was
/// enough to fail the whole page decode. Optional fields with defaults let
/// stale rows still render as "unknown".
struct PullRequest: Identifiable, Decodable, Hashable {
    let id: Int64
    let repo: String?
    let number: Int?
    let title: String?
    let state: String?
    let author: String?
    /// Server returns this as a JSON boolean (SQLite stores 0/1, D1 or
    /// somewhere along the way converts). Kept as Bool? to match the wire
    /// format — decoding an Int here fails when the value is `false`.
    let draft: Bool?
    let headRef: String?
    let createdAt: String?
    let updatedAt: String?
    let htmlUrl: String?
    let mergedAt: String?
    let requestedReviewers: [Reviewer]?

    struct Reviewer: Decodable, Hashable {
        let login: String?
    }

    var isDraft: Bool { draft ?? false }
    var displayRepo: String { repo ?? "?" }
    var displayNumber: Int { number ?? 0 }
    var displayTitle: String { (title?.isEmpty == false ? title : nil) ?? "(untitled)" }
    var displayUpdatedAt: String { updatedAt ?? createdAt ?? "" }
    var displayUrl: String { htmlUrl ?? "" }
    var isMerged: Bool { mergedAt?.isEmpty == false || state?.lowercased() == "merged" }
    var isOpen: Bool {
        guard !isMerged else { return false }
        guard let state = state?.lowercased(), !state.isEmpty else { return true }
        return state == "open"
    }

    var reviewerLogins: [String] {
        (requestedReviewers ?? []).compactMap(\.login)
    }

    enum CodingKeys: String, CodingKey {
        case id, repo, number, title, state, author
        case draft
        case headRef = "head_ref"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case htmlUrl = "html_url"
        case mergedAt = "merged_at"
        case requestedReviewers = "requested_reviewers"
    }
}

struct Issue: Identifiable, Decodable, Hashable {
    struct Assignee: Decodable, Hashable {
        let login: String
        let avatarUrl: String?

        enum CodingKeys: String, CodingKey {
            case login, avatarUrl = "avatar_url"
        }
    }

    struct Label: Decodable, Hashable {
        let name: String
        let color: String?
    }

    let id: Int64
    let repo: String?
    let number: Int?
    let title: String?
    let state: String?
    let assignees: [Assignee]?
    let labels: [Label]?
    let createdAt: String?
    let updatedAt: String?
    let closedAt: String?
    let htmlUrl: String?

    var displayRepo: String { repo ?? "?" }
    var displayNumber: Int { number ?? 0 }
    var displayTitle: String { (title?.isEmpty == false ? title : nil) ?? "(untitled)" }
    var displayUpdatedAt: String { updatedAt ?? createdAt ?? "" }
    var displayUrl: String { htmlUrl ?? "" }
    var assignedPeople: [Assignee] { assignees ?? [] }
    var isCritical: Bool { (labels ?? []).contains { $0.name.caseInsensitiveCompare("critical") == .orderedSame } }

    enum CodingKeys: String, CodingKey {
        case id, repo, number, title, state, assignees, labels
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case closedAt = "closed_at"
        case htmlUrl = "html_url"
    }
}

/// An open NoxTicket feature. Features are organization-wide rather than
/// attached to a product repository; `owners` determines whose Current page
/// includes the feature.
struct NoxTicketFeature: Identifiable, Decodable, Hashable {
    struct Owner: Decodable, Hashable {
        let login: String
    }

    struct Label: Decodable, Hashable {
        let name: String
    }

    let id: Int64
    let number: Int
    let title: String
    let assignees: [Owner]
    let labels: [Label]
    let htmlUrl: String?
    let updatedAt: String?

    var owners: [String] { assignees.map(\.login) }
    var isBacklog: Bool { labels.contains { $0.name.caseInsensitiveCompare("backlog") == .orderedSame } }
    var status: String {
        labels.first { $0.name.hasPrefix("status:") }
            .map { String($0.name.dropFirst("status:".count)) } ?? "todo"
    }

    enum CodingKeys: String, CodingKey {
        case id, number, title, assignees, labels
        case htmlUrl = "html_url"
        case updatedAt = "updated_at"
    }
}

struct PagedResponse<T: Decodable>: Decodable {
    let data: [T]
    let totalCount: Int?
    let page: Int?
    let pageSize: Int?

    enum CodingKeys: String, CodingKey {
        case data, page
        case totalCount
        case pageSize
    }
}
