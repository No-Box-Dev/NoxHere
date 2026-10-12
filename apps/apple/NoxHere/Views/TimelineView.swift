import SwiftUI

/// Compact, status-only history for a single PR. Narrative content and
/// review bodies live elsewhere; this list is intentionally only the latest
/// three days of meaningful state changes.
struct TimelineView: View {
    let pr: PRRef

    @EnvironmentObject private var state: AppState
    @EnvironmentObject private var cache: TimelineCache
    @StateObject private var store = TimelineStore()

    var body: some View {
        Group {
            if store.isLoading && store.groups.isEmpty {
                CenteredProgressView()
            } else if let err = store.errorMessage, store.groups.isEmpty {
                RetryErrorView(message: err) { Task { await reload() } }
            } else if store.groups.isEmpty {
                VStack(spacing: 10) {
                    Spacer()
                    Image(systemName: "clock").font(.system(size: 22)).foregroundStyle(UT.textTertiary)
                    Text("No status changes in the last 3 days.")
                        .font(.system(size: 13)).foregroundStyle(UT.textMuted)
                    Spacer()
                }
            } else {
                VStack(spacing: 0) {
                    HStack {
                        Text("Status changes")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(UT.textPrimary)
                        Spacer()
                        Text("Last 3 days")
                            .font(.system(size: 10))
                            .foregroundStyle(UT.textTertiary)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    Divider().overlay(UT.borderSoft)
                    ScrollView {
                        LazyVStack(spacing: 6) {
                            ForEach(store.groups) { group in
                                TimelineGroupCard(group: group)
                            }
                        }
                        .padding(14)
                    }
                }
            }
        }
        .task(id: "\(pr.org)/\(pr.repo)#\(pr.number)") { await reload() }
    }

    private func reload() async {
        await store.load(repo: pr.repo, prNumber: pr.number, client: state.makeAPIClient(), cache: cache)
    }
}

// MARK: - Group card

private struct TimelineGroupCard: View {
    let group: TimelineStore.TimelineGroup

    var body: some View {
        header
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Avatar(url: group.actorAvatarUrl, initials: initials, size: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(eventTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    PillView(text: kindLabel, style: pillStyle)
                    if isDraft {
                        PillView(text: "DRAFT", style: .mono)
                    }
                    if let actor = group.actorLogin {
                        Text("@\(actor)")
                            .font(.system(size: 10))
                            .foregroundStyle(UT.textMuted)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
            Text(DisplayDateFormatter.string(for: group.createdAt))
                .font(.system(size: 10))
                .foregroundStyle(UT.textTertiary)
        }
    }

    // MARK: - Styling

    private var initials: String {
        (group.actorLogin?.first.map(String.init) ?? "?").uppercased()
    }

    private var kindLabel: String {
        switch group.kind {
        case .opened: return "Opened PR"
        case .merged: return "Merged"
        case .closed: return "Closed"
        case .reopened: return "Reopened"
        case .changesMade: return "Changes made"
        case .reviewed(let o):
            if group.isBot && o != .changesRequested { return "Bot reviewed" }
            return o.label
        }
    }

    private var eventTitle: String {
        let who = group.actorLogin.map { "@\($0)" }
        switch group.kind {
        case .opened(let draft):
            return draft ? "Draft opened" : (who.map { "\($0) opened the PR" } ?? "PR opened")
        case .merged: return who.map { "\($0) merged the PR" } ?? "PR merged"
        case .closed: return who.map { "\($0) closed the PR" } ?? "PR closed"
        case .reopened: return who.map { "\($0) reopened the PR" } ?? "PR reopened"
        case .changesMade: return who.map { "\($0) made changes" } ?? "Changes made"
        case .reviewed(.approved):
            return group.isBot ? (who.map { "\($0) reviewed" } ?? "Bot reviewed")
                : (who.map { "\($0) approved" } ?? "Review approved")
        case .reviewed(.changesRequested):
            return who.map { "\($0) requested changes" } ?? "Changes requested"
        case .reviewed(.commented):
            return group.isBot ? (who.map { "\($0) reviewed" } ?? "Bot reviewed")
                : (who.map { "\($0) reviewed" } ?? "Review added")
        }
    }

    private var pillStyle: PillStyle {
        switch group.kind {
        case .opened: return .accent
        case .merged, .reviewed(.approved): return .success
        case .reopened: return .accent
        case .changesMade: return .accent
        case .closed: return .mono
        case .reviewed(.changesRequested): return .warn
        case .reviewed(.commented): return .mono
        }
    }

    private var isDraft: Bool {
        if case .opened(let draft) = group.kind { return draft }
        return false
    }

}
