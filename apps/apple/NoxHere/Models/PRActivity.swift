import Foundation

/// A concise rendering of the newest meaningful event for a PR. This is an
/// activity label, not a guessed mergeability state: what the row says is
/// always backed by either the current PR record or a stored timeline event.
struct PRActivity: Hashable {
    enum Kind: Hashable {
        case draft
        case opened
        case reviewRequested
        case reviewed
        case botReviewed
        case changesRequested
        case changesMade
        case approved
        case merged
        case closed
        case reopened
    }

    let kind: Kind
    let actor: String?
    let date: Date?

    var badge: String {
        switch kind {
        case .draft: return "DRAFT"
        case .opened: return "OPENED"
        case .reviewRequested: return "REVIEW REQUESTED"
        case .reviewed: return "REVIEWED"
        case .botReviewed: return "BOT REVIEWED"
        case .changesRequested: return "CHANGES REQUESTED"
        case .changesMade: return "CHANGES MADE"
        case .approved: return "APPROVED"
        case .merged: return "MERGED"
        case .closed: return "CLOSED"
        case .reopened: return "REOPENED"
        }
    }

    var title: String {
        let who = actor.map { "@\($0)" }
        switch kind {
        case .draft: return "Draft in progress"
        case .opened: return who.map { "\($0) opened the PR" } ?? "PR opened"
        case .reviewRequested: return "Review requested"
        case .reviewed: return who.map { "\($0) reviewed" } ?? "Review added"
        case .botReviewed: return who.map { "\($0) reviewed" } ?? "Bot reviewed"
        case .changesRequested: return who.map { "\($0) requested changes" } ?? "Changes requested"
        case .changesMade: return who.map { "\($0) made changes" } ?? "Changes made"
        case .approved: return who.map { "\($0) approved" } ?? "Review approved"
        case .merged: return who.map { "\($0) merged the PR" } ?? "PR merged"
        case .closed: return who.map { "\($0) closed the PR" } ?? "PR closed"
        case .reopened: return who.map { "\($0) reopened the PR" } ?? "PR reopened"
        }
    }

    static func latest(for pr: PullRequest, event: FeedEvent?) -> PRActivity {
        if pr.isMerged {
            return PRActivity(kind: .merged, actor: eventActor(event), date: event?.createdAt ?? parse(pr.mergedAt))
        }
        if pr.state?.lowercased() == "closed" {
            return PRActivity(kind: .closed, actor: eventActor(event), date: event?.createdAt ?? parse(pr.displayUpdatedAt))
        }

        if let event, let kind = kind(for: event) {
            return PRActivity(kind: kind, actor: eventActor(event), date: event.createdAt)
        }
        if pr.isDraft {
            return PRActivity(kind: .draft, actor: pr.author, date: parse(pr.displayUpdatedAt))
        }
        if !pr.reviewerLogins.isEmpty {
            return PRActivity(kind: .reviewRequested, actor: nil, date: parse(pr.displayUpdatedAt))
        }
        return PRActivity(kind: .opened, actor: pr.author, date: parse(pr.displayUpdatedAt))
    }

    static func isMeaningful(_ event: FeedEvent) -> Bool {
        kind(for: event) != nil
    }

    private static func kind(for event: FeedEvent) -> Kind? {
        switch event.type {
        case "github:pr:opened": return event.payload?.isDraft == true ? .draft : .opened
        case "github:pr:merged": return .merged
        case "github:pr:closed": return .closed
        case "github:pr:reopened": return .reopened
        case "github:pr:synchronize", "github:pr:changes_made": return .changesMade
        case "github:push": return .changesMade
        case "github:pr:review:approved":
            return isBot(event.payload?.reviewerLogin) ? .botReviewed : .approved
        case "github:pr:review:changes_requested": return .changesRequested
        case "github:pr:review:commented":
            return isBot(event.payload?.reviewerLogin) ? .botReviewed : .reviewed
        default: return nil
        }
    }

    private static func eventActor(_ event: FeedEvent?) -> String? {
        event?.payload?.reviewerLogin
            ?? event?.payload?.pusherLogin
            ?? event?.payload?.authorLogin
            ?? event?.actorId
    }

    static func isBot(_ login: String?) -> Bool {
        guard let value = login?.lowercased() else { return false }
        return value.hasSuffix("[bot]") || value.hasSuffix("-bot") || value.contains("coderabbit")
    }

    private static func parse(_ value: String?) -> Date? {
        DisplayDateFormatter.parse(value)
    }
}
