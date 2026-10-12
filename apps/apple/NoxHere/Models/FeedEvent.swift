import Foundation

struct FeedEvent: Identifiable, Decodable, Hashable {
    let id: Int64
    let type: String
    let actorId: String?
    let org: String?
    let repo: String?
    let summary: String
    let createdAt: Date
    let payload: PayloadFields?

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case actorId = "actor_id"
        case org
        case repo
        case summary
        case createdAt = "created_at"
        case payload = "payload_json"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int64.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        actorId = try c.decodeIfPresent(String.self, forKey: .actorId)
        org = try c.decodeIfPresent(String.self, forKey: .org)
        repo = try c.decodeIfPresent(String.self, forKey: .repo)
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        createdAt = try FeedEvent.decodeDate(from: c, forKey: .createdAt)
        payload = FeedEvent.decodePayload(from: c, forKey: .payload)
    }

    struct PayloadFields: Hashable {
        /// GitHub webhook action (opened, ready_for_review, synchronize,
        /// reopened, closed...). Kept so the UI can title a timeline event
        /// by what actually happened instead of inferring from timestamps.
        let action: String?
        /// Push ref + pusher are used to associate a real branch update
        /// with the open PR whose head_ref matches it.
        let pushRef: String?
        let pusherLogin: String?
        let prNumber: Int?
        let prTitle: String?
        let prUrl: String?
        let authorLogin: String?
        let authorAvatarUrl: String?
        /// Review state ("approved", "changes_requested", "commented").
        let reviewState: String?
        /// Who wrote the review (`review.author`). Distinct from
        /// `authorLogin`, which resolves to the PR author on review events.
        let reviewerLogin: String?
        /// True if the PR was opened as a draft (github webhook flag).
        let isDraft: Bool?
    }

    private static func decodeDate(from c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) throws -> Date {
        let raw = try c.decode(String.self, forKey: key)
        if let d = ISO8601DateFormatter.withFractional.date(from: raw) { return d }
        if let d = ISO8601DateFormatter.plain.date(from: raw) { return d }
        throw DecodingError.dataCorruptedError(
            forKey: key,
            in: c,
            debugDescription: "Expected an ISO-8601 timestamp, got \(raw)"
        )
    }

    private static func decodePayload(from c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> PayloadFields? {
        guard let raw = try? c.decodeIfPresent(String.self, forKey: key),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        // PR number lives in different places depending on which writer:
        //   raw github events  → $.pr.number
        //   narrator rows      → $.pr_number (top-level)
        //   issue-derived rows → $.issue.number
        let pr = obj["pr"] as? [String: Any]
        let issue = obj["issue"] as? [String: Any]
        let prNumber = (pr?["number"] as? Int)
            ?? (obj["pr_number"] as? Int)
            ?? (issue?["number"] as? Int)

        // Author is stored two different ways:
        //   raw pull_request events → `pr.author` is a STRING (the login)
        //     — see slimPayload in functions/lib/events.js
        //   older-shape / GitHub-native → nested object with login + avatar
        //   review events → `review.author` is a string too
        let review = obj["review"] as? [String: Any]
        let authorLogin: String? = {
            if let s = pr?["author"] as? String { return s }
            if let s = review?["author"] as? String { return s }
            if let s = issue?["author"] as? String { return s }
            if let dict = pr?["author"] as? [String: Any] { return dict["login"] as? String }
            if let dict = issue?["author"] as? [String: Any] { return dict["login"] as? String }
            if let dict = obj["author"] as? [String: Any] { return dict["login"] as? String }
            return nil
        }()
        // Avatar only ever comes from a nested object shape; the string
        // form doesn't carry it. TimelineStore fills the gap by joining
        // event.actor_id against the actors list.
        let authorDict = (pr?["author"] as? [String: Any])
            ?? (issue?["author"] as? [String: Any])
            ?? (obj["author"] as? [String: Any])
        return PayloadFields(
            action: obj["action"] as? String,
            pushRef: obj["ref"] as? String,
            pusherLogin: obj["pusher"] as? String,
            prNumber: prNumber,
            prTitle: (pr?["title"] as? String) ?? (issue?["title"] as? String),
            prUrl: (pr?["html_url"] as? String) ?? (issue?["html_url"] as? String),
            authorLogin: authorLogin,
            authorAvatarUrl: authorDict?["avatar_url"] as? String,
            reviewState: review?["state"] as? String,
            reviewerLogin: review?["author"] as? String,
            isDraft: pr?["draft"] as? Bool
        )
    }
}

struct FeedPage: Decodable {
    let events: [FeedEvent]
    let nextCursor: String?
}

enum FeedMode: String, CaseIterable, Identifiable, Hashable {
    case current
    case opened
    case posts
    case releaseNotes
    case issues

    var id: String { rawValue }

    var usesFeedStore: Bool {
        self != .current && self != .issues
    }

    var apiType: String {
        switch self {
        case .opened: return "pr_narrative"
        case .posts: return "narrative"
        case .releaseNotes: return "release_notes"
        case .current, .issues: return ""
        }
    }

    var triggerTypes: [String] {
        switch self {
        case .opened: return ["github:pr:opened"]
        case .posts, .releaseNotes: return ["github:pr:merged"]
        case .current, .issues: return []
        }
    }

    var label: String {
        switch self {
        case .opened: return "Opened"
        case .posts: return "Merged"
        case .releaseNotes: return "Notes"
        case .current: return "Current"
        case .issues: return "Issues"
        }
    }
}

private extension ISO8601DateFormatter {
    static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
