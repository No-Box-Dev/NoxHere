import Foundation

struct GitHubPRDetails: Decodable, Hashable {
    let body: String?
    let comments: Int
    let reviewComments: Int
    let additions: Int
    let deletions: Int
    let changedFiles: Int
    let merged: Bool

    enum CodingKeys: String, CodingKey {
        case body, comments, additions, deletions, merged
        case reviewComments = "review_comments"
        case changedFiles = "changed_files"
    }
}

struct GitHubPRComments: Decodable, Hashable {
    let comments: [GitHubPRComment]
    let truncated: Bool
}

struct GitHubPRComment: Identifiable, Decodable, Hashable {
    enum Kind: String, Decodable {
        case comment
        case review
        case reviewComment = "review_comment"
    }

    let id: String
    let kind: Kind
    let body: String
    let authorLogin: String?
    let authorAvatarURL: String?
    let createdAt: String
    let htmlURL: String?
    let state: String?
    let path: String?
    let line: Int?

    enum CodingKeys: String, CodingKey {
        case id, kind, body, state, path, line
        case authorLogin = "author_login"
        case authorAvatarURL = "author_avatar_url"
        case createdAt = "created_at"
        case htmlURL = "html_url"
    }
}
