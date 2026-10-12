import SwiftUI
import AppKit

struct PRCommentsView: View {
    let pr: PRRef

    @EnvironmentObject private var state: AppState
    @State private var page: GitHubPRComments?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && page == nil {
                CenteredProgressView()
            } else if let errorMessage, page == nil {
                RetryErrorView(message: errorMessage) { Task { await load() } }
            } else if page?.comments.isEmpty != false {
                emptyState
            } else {
                VStack(spacing: 0) {
                    sectionHeader
                    Divider().overlay(UT.borderSoft)
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            if page?.truncated == true {
                                Label("This PR has more than 2,000 items in one comment stream. Open GitHub to see the remainder.", systemImage: "exclamationmark.triangle.fill")
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(UT.warnText)
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(UT.warnBg, in: RoundedRectangle(cornerRadius: 9))
                            }
                            ForEach(page?.comments ?? []) { comment in
                                PRCommentCard(comment: comment)
                            }
                        }
                        .padding(14)
                    }
                }
            }
        }
        .task(id: pr.id) { await load() }
    }

    private var sectionHeader: some View {
        HStack {
            Text("GitHub conversation")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
            Spacer()
            Text("\(page?.comments.count ?? 0) item\((page?.comments.count ?? 0) == 1 ? "" : "s")")
                .font(.system(size: 10))
                .foregroundStyle(UT.textTertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Spacer()
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 22))
                .foregroundStyle(UT.textTertiary)
            Text("No comments yet.")
                .font(.system(size: 13))
                .foregroundStyle(UT.textMuted)
            Text("Comments and review notes from GitHub will appear here.")
                .font(.system(size: 10.5))
                .foregroundStyle(UT.textTertiary)
            Spacer()
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            page = try await state.makeAPIClient().fetchGitHubPRComments(repo: pr.repo, number: pr.number)
        } catch {
            errorMessage = error.userFacingDescription
        }
        isLoading = false
    }
}

private struct PRCommentCard: View {
    let comment: GitHubPRComment

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 8) {
                Avatar(url: comment.authorAvatarURL, initials: initials, size: 25)
                VStack(alignment: .leading, spacing: 2) {
                    Text(comment.authorLogin.map { "@\($0)" } ?? "Unknown GitHub user")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(UT.textPrimary)
                    HStack(spacing: 5) {
                        PillView(text: kindLabel, style: kindStyle)
                        if let location { Text(location).font(.system(size: 9.5, design: .monospaced)).foregroundStyle(UT.textMuted).lineLimit(1) }
                    }
                }
                Spacer()
                Text(displayDate)
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textTertiary)
            }

            MarkdownText(comment.body)

            if let url = comment.htmlURL, let destination = URL(string: url) {
                Button { NSWorkspace.shared.open(destination) } label: {
                    Label("Open comment on GitHub", systemImage: "arrow.up.right.square")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(UT.accent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
    }

    private var initials: String {
        comment.authorLogin?.first.map { String($0).uppercased() } ?? "?"
    }

    private var kindLabel: String {
        switch comment.kind {
        case .comment: return "Comment"
        case .reviewComment: return "Code comment"
        case .review: return comment.state?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Review"
        }
    }

    private var kindStyle: PillStyle {
        switch comment.state {
        case "approved": return .success
        case "changes_requested": return .warn
        default: return .mono
        }
    }

    private var location: String? {
        guard let path = comment.path else { return nil }
        return comment.line.map { "\(path):\($0)" } ?? path
    }

    private var displayDate: String {
        guard let date = DisplayDateFormatter.parse(comment.createdAt) else { return "" }
        return DisplayDateFormatter.string(for: date)
    }
}
