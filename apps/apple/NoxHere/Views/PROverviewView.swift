import SwiftUI

struct PROverviewView: View {
    let pr: PRRef

    @EnvironmentObject private var state: AppState
    @State private var snapshot: PullRequest?
    @State private var details: GitHubPRDetails?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && snapshot == nil && details == nil {
                CenteredProgressView()
            } else if let errorMessage, snapshot == nil && details == nil {
                RetryErrorView(message: errorMessage) { Task { await load() } }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        summaryCard
                        descriptionCard
                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 10.5))
                                .foregroundStyle(UT.warnText)
                        }
                    }
                    .padding(14)
                }
            }
        }
        .task(id: pr.id) { await load() }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(snapshot?.displayTitle ?? pr.title ?? "Pull request #\(pr.number)")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                PillView(text: statusLabel, style: statusStyle)
                if snapshot?.isDraft == true { PillView(text: "Draft", style: .mono) }
                if let author = snapshot?.author { Text("@\(author)").font(.system(size: 10)).foregroundStyle(UT.textMuted) }
                Spacer()
            }

            if let head = snapshot?.headRef, !head.isEmpty {
                Label(head, systemImage: "arrow.triangle.branch")
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundStyle(UT.textMuted)
            }

            if let details {
                HStack(spacing: 12) {
                    metric("+\(details.additions)", color: UT.successText)
                    metric("−\(details.deletions)", color: UT.warnText)
                    metric("\(details.changedFiles) file\(details.changedFiles == 1 ? "" : "s")", color: UT.textMuted)
                    metric("\(details.comments + details.reviewComments) comment\(details.comments + details.reviewComments == 1 ? "" : "s")", color: UT.textMuted)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
    }

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Description")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
            if let body = details?.body, !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                MarkdownText(body)
            } else {
                Text("No description was added to this pull request.")
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textTertiary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
    }

    private var statusLabel: String {
        if details?.merged == true || snapshot?.isMerged == true { return "Merged" }
        return (snapshot?.state ?? "Open").capitalized
    }

    private var statusStyle: PillStyle {
        statusLabel == "Merged" ? .success : statusLabel == "Open" ? .accent : .mono
    }

    private func metric(_ text: String, color: Color) -> some View {
        Text(text).font(.system(size: 10, weight: .medium)).foregroundStyle(color)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            async let loadedSnapshot = state.makeAPIClient().fetchPR(repo: pr.repo, number: pr.number)
            async let loadedDetails = state.makeAPIClient().fetchGitHubPRDetails(repo: pr.repo, number: pr.number)
            let values = try await (loadedSnapshot, loadedDetails)
            snapshot = values.0
            details = values.1
        } catch {
            errorMessage = error.userFacingDescription
        }
        isLoading = false
    }
}

struct MarkdownText: View {
    private let value: AttributedString

    init(_ source: String) {
        value = (try? AttributedString(markdown: source, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(source)
    }

    var body: some View {
        Text(value)
            .font(.system(size: 11.5))
            .foregroundStyle(UT.textBody)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
    }
}
