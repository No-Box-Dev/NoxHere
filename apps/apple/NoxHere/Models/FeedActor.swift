import Foundation

struct FeedActor: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let githubLogin: String?
    let avatarUrl: String?
    let kind: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case githubLogin = "github_login"
        case avatarUrl = "avatar_url"
        case kind
    }

    var displayName: String {
        if !name.isEmpty { return name }
        return githubLogin ?? id
    }
}

struct FeedProject: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let slug: String?
    let repo: String?
    let archived: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case repo
        case archived
    }

    var isArchived: Bool { (archived ?? 0) == 1 }

    /// Only active records backed by a GitHub repository belong in the feed
    /// repository picker. Product-only records have no `repo` value.
    var isTrackedRepository: Bool {
        !isArchived && !(repo?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    }

    var repositoryDisplayName: String {
        let repository = repo?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return repository.isEmpty ? displayName : repository
    }

    var displayName: String {
        if let slug, !slug.isEmpty { return slug }
        if !name.isEmpty { return name }
        return id
    }
}

struct GitHubMe: Decodable, Hashable {
    let login: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case login
        case avatarUrl = "avatar_url"
    }
}
