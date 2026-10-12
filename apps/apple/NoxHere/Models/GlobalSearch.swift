import Foundation

enum GlobalSearchKind: String, Decodable, CaseIterable {
    case person
    case pullRequest = "pull_request"
    case issue
    case feature
    case post
    case releaseNote = "release_note"

    var sectionTitle: String {
        switch self {
        case .person: return "People"
        case .pullRequest: return "Pull Requests"
        case .issue: return "Issues"
        case .feature: return "Features"
        case .post: return "Posts"
        case .releaseNote: return "Release Notes"
        }
    }

    var systemImage: String {
        switch self {
        case .person: return "person.crop.circle.fill"
        case .pullRequest: return "arrow.triangle.pull"
        case .issue: return "record.circle"
        case .feature: return "sparkles"
        case .post: return "text.bubble.fill"
        case .releaseNote: return "doc.text.fill"
        }
    }
}

struct GlobalSearchResult: Identifiable, Decodable, Hashable {
    let id: String
    let kind: GlobalSearchKind
    let title: String
    let subtitle: String
    let repo: String?
    let number: Int?
    let state: String?
    let url: String?
    let avatarUrl: String?
    let login: String?

    var personLogin: String? {
        guard kind == .person else { return nil }
        return login ?? (title.hasPrefix("@") ? String(title.dropFirst()) : title)
    }
}

struct GlobalSearchResponse: Decodable, Hashable {
    let results: [GlobalSearchResult]
}
