import SwiftUI
import AppKit

// MARK: - Person view

struct PersonView: View {
    let login: String
    @ObservedObject var store: MeStore
    var searchQuery: String = ""
    var repository: String?
    let onBack: () -> Void

    @EnvironmentObject private var state: AppState

    /// Show teammates' non-draft PRs only (drafts read as noise — the
    /// author is telegraphing "not ready"). On the signed-in user's own
    /// page, show drafts too — those are their personal todo list.
    private var visiblePRs: [PullRequest] {
        var prs = login == state.activeLogin ? store.prs : store.prs.filter { !$0.isDraft }
        if let repository { prs = prs.filter { $0.repo == repository } }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            prs = prs.filter {
                $0.displayTitle.localizedCaseInsensitiveContains(query)
                    || $0.displayRepo.localizedCaseInsensitiveContains(query)
                    || String($0.displayNumber).contains(query)
            }
        }
        return prs
    }

    private var visibleIssues: [Issue] {
        var issues = store.issues
        if let repository { issues = issues.filter { $0.repo == repository } }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            issues = issues.filter {
                $0.displayTitle.localizedCaseInsensitiveContains(query)
                    || $0.displayRepo.localizedCaseInsensitiveContains(query)
                    || String($0.displayNumber).contains(query)
            }
        }
        return issues
    }

    private var visibleFeatures: [NoxTicketFeature] {
        var features = store.features.filter { feature in
            !feature.isBacklog
                && feature.owners.contains { $0.caseInsensitiveCompare(login) == .orderedSame }
        }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            features = features.filter {
                $0.title.localizedCaseInsensitiveContains(query)
                    || $0.status.localizedCaseInsensitiveContains(query)
                    || String($0.number).contains(query)
            }
        }
        return features
    }

    private var hiddenDraftCount: Int {
        guard repository == nil,
              searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return 0 }
        return store.prs.count - visiblePRs.count
    }

    var body: some View {
        VStack(spacing: 0) {
            personHeader
            Divider().overlay(UT.border)
            content
        }
    }

    private var personHeader: some View {
        HStack(spacing: 8) {
            Button(action: onBack) {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold))
                    Text("All people").font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(UT.accent)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
            Text("@\(login)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
            Spacer()
            // Symmetry spacer so the login label stays centered.
            Color.clear.frame(width: 88, height: 1)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(UT.card)
    }

    @ViewBuilder
    private var content: some View {
        if store.isLoading && visiblePRs.isEmpty && visibleIssues.isEmpty && visibleFeatures.isEmpty {
            CenteredProgressView()
        } else if let err = store.errorMessage, visiblePRs.isEmpty && visibleIssues.isEmpty && visibleFeatures.isEmpty {
            RetryErrorView(message: err) { Task { await store.refresh() } }
        } else if visiblePRs.isEmpty && visibleIssues.isEmpty && visibleFeatures.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    section(title: "Open PRs", count: visiblePRs.count, empty: "No open PRs.") {
                        ForEach(visiblePRs) { pr in
                            PRRow(pr: pr, activity: store.latestActivity(for: pr))
                        }
                        if hiddenDraftCount > 0 {
                            Text("\(hiddenDraftCount) draft\(hiddenDraftCount == 1 ? "" : "s") hidden")
                                .font(.system(size: 10))
                                .foregroundStyle(UT.textTertiary)
                                .padding(.top, 2)
                        }
                    }
                    section(title: "Assigned issues", count: visibleIssues.count, empty: "No assigned issues.") {
                        ForEach(visibleIssues) { issue in IssueRow(issue: issue) }
                    }
                    if store.noxTicketEnabled {
                        section(title: "Features", count: visibleFeatures.count, empty: "No owned features.") {
                            ForEach(visibleFeatures) { feature in FeatureRow(feature: feature) }
                        }
                    }
                }
                .padding(14)
            }
        }
    }

    @ViewBuilder
    private func section<Content: View>(
        title: String, count: Int, empty: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(title).font(.system(size: 11, weight: .semibold)).foregroundStyle(UT.textPrimary)
                Text(String(count)).font(.system(size: 10, weight: .medium)).foregroundStyle(UT.textMuted)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(Capsule().fill(UT.borderSoft))
                Spacer()
            }
            if count == 0 {
                Text(empty).font(.system(size: 11)).foregroundStyle(UT.textTertiary).padding(.vertical, 4)
            } else {
                VStack(spacing: 6) { content() }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            Image(systemName: query.isEmpty ? "checkmark.seal" : "magnifyingglass")
                .font(.system(size: 22)).foregroundStyle(UT.textTertiary)
            Text(query.isEmpty
                 ? "@\(login) is all caught up — nothing open right now."
                 : "No current work matches \"\(query)\".")
                .font(.system(size: 12)).foregroundStyle(UT.textMuted).multilineTextAlignment(.center)
            if query.isEmpty {
                Button("Retry") { Task { await store.refresh() } }
                    .buttonStyle(.plain).foregroundStyle(UT.accent).font(.system(size: 11))
            }
        }
        .frame(maxWidth: .infinity).padding(24)
        .cardStyle(cornerRadius: 12)
        .padding(14)
    }
}

// MARK: - People list

struct PeopleList: View {
    let members: [APIClient.OrgMember]
    let searchQuery: String
    let stats: APIClient.EngineerStats?
    let error: String?
    let isLoading: Bool
    let hasLoaded: Bool
    let activeLogin: String?
    let onPick: (String) -> Void
    let onRetry: () -> Void

    var body: some View {
        Group {
            if let error, members.isEmpty, !isLoading {
                RetryErrorView(message: error, retry: onRetry)
            } else if isLoading, members.isEmpty {
                CenteredProgressView()
            } else if members.isEmpty,
                      !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                EmptyStateCard(
                    text: "No people match \"\(searchQuery.trimmingCharacters(in: .whitespacesAndNewlines))\"."
                )
                .padding(14)
            } else if members.isEmpty, hasLoaded {
                EmptyStateCard(text: "No organization members are available.")
                    .padding(14)
            } else if members.isEmpty {
                CenteredProgressView()
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        if let error {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(.orange)
                                Text(error)
                                    .font(.system(size: 10))
                                    .foregroundStyle(UT.textMuted)
                                    .lineLimit(2)
                                Spacer(minLength: 4)
                                Button("Retry", action: onRetry)
                                    .buttonStyle(.borderless)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(UT.warnBg))
                        }
                        ForEach(sortedMembers) { m in
                            PersonRow(
                                member: m,
                                isMe: m.login == activeLogin,
                                prCount: stats.map { $0.prCount(m.login) },
                                reviewingCount: stats.map { $0.reviewingCount(m.login) },
                                issueCount: stats.map { $0.issueCount(m.login) },
                                onTap: { onPick(m.login) }
                            )
                        }
                    }
                    .padding(14)
                }
            }
        }
    }

    /// Sort: signed-in user first (always pinned to top so "me" is one
    /// glance away), then busiest first (most open items above quieter
    /// people), then alphabetical for ties.
    private var sortedMembers: [APIClient.OrgMember] {
        members.sorted { a, b in
            if a.login == activeLogin { return true }
            if b.login == activeLogin { return false }
            let aTotal = totalOpen(a.login)
            let bTotal = totalOpen(b.login)
            if aTotal != bTotal { return aTotal > bTotal }
            return a.login.lowercased() < b.login.lowercased()
        }
    }

    private func totalOpen(_ login: String) -> Int {
        (stats?.prCount(login) ?? 0)
            + (stats?.reviewingCount(login) ?? 0)
            + (stats?.issueCount(login) ?? 0)
    }
}

private struct PersonRow: View {
    let member: APIClient.OrgMember
    let isMe: Bool
    let prCount: Int?
    let reviewingCount: Int?
    let issueCount: Int?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Avatar(url: member.avatarUrl, initials: String(member.login.prefix(1)).uppercased(), size: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("@\(member.login)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(UT.textPrimary)
                    if isMe {
                        Text("You").font(.system(size: 10)).foregroundStyle(UT.accent)
                    }
                }
                Spacer(minLength: 4)
                HStack(spacing: 4) {
                    CountChip(
                        count: prCount,
                        systemImage: "arrow.triangle.branch",
                        tooltip: prCount.map { "\($0) open PR\($0 == 1 ? "" : "s") authored by @\(member.login)" }
                            ?? "Open PR count is temporarily unavailable"
                    )
                    CountChip(
                        count: reviewingCount,
                        systemImage: "checklist",
                        tooltip: reviewingCount.map { "\($0) PR\($0 == 1 ? "" : "s") waiting for @\(member.login)'s review" }
                            ?? "Review count is temporarily unavailable"
                    )
                    CountChip(
                        count: issueCount,
                        systemImage: "smallcircle.filled.circle",
                        tooltip: issueCount.map { "\($0) open issue\($0 == 1 ? "" : "s") assigned to @\(member.login)" }
                            ?? "Issue count is temporarily unavailable"
                    )
                }
                Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(UT.textTertiary)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

/// Small pill showing a count + icon. Renders muted when count is 0, accent
/// when positive, and a dash when the count could not be verified. Hover for
/// a tooltip explaining exactly what the value represents.
private struct CountChip: View {
    let count: Int?
    let systemImage: String
    let tooltip: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage).font(.system(size: 9))
            Text(count.map(String.init) ?? "–").font(.system(size: 10, weight: .semibold))
        }
        .foregroundStyle((count ?? 0) > 0 ? UT.accent : UT.textTertiary)
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(
            Capsule().fill((count ?? 0) > 0 ? UT.accentSoft : UT.borderSoft)
        )
        .help(tooltip)
    }
}

// MARK: - PR + Issue rows

private struct PRRow: View {
    let pr: PullRequest
    let activity: PRActivity
    @EnvironmentObject private var state: AppState
    @State private var isOpeningNoteExpanded = false
    @State private var openingNote: String?
    @State private var releaseNote: String?
    @State private var notesError: String?
    @State private var didLoadNotes = false
    @State private var isLoadingNotes = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Button { openTimeline() } label: {
                    itemRow(
                        icon: "arrow.triangle.pull",
                        title: pr.displayTitle,
                        repo: pr.displayRepo,
                        number: pr.displayNumber,
                        stateChip: nil,
                        activity: activity,
                        age: pr.displayUpdatedAt
                    )
                }
                .buttonStyle(.plain)
                .help("Open Timeline for this PR")

                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isOpeningNoteExpanded.toggle()
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(UT.textTertiary)
                        .rotationEffect(.degrees(isOpeningNoteExpanded ? 180 : 0))
                        .frame(width: 30, height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(isOpeningNoteExpanded ? "Hide opening note" : "Show opening note")
                .padding(.trailing, 4)
            }

            if isOpeningNoteExpanded {
                Divider().overlay(UT.borderSoft).padding(.horizontal, 10)
                openingNoteBody
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .cardStyle()
        .task(id: isOpeningNoteExpanded) {
            guard isOpeningNoteExpanded, !didLoadNotes else { return }
            await loadNotes()
        }
    }

    @ViewBuilder
    private var openingNoteBody: some View {
        if isLoadingNotes {
            HStack(spacing: 6) {
                ProgressView().controlSize(.small)
                Text("Loading notes…")
            }
            .font(.system(size: 10))
            .foregroundStyle(UT.textMuted)
        } else if openingNote != nil || releaseNote != nil {
            VStack(alignment: .leading, spacing: 3) {
                if let openingNote {
                    noteSection(title: "Plain opening note", text: openingNote)
                }
                if let releaseNote {
                    if openingNote != nil {
                        Divider().overlay(UT.borderSoft).padding(.vertical, 5)
                    }
                    noteSection(title: "Release note", text: releaseNote)
                } else if openingNote != nil {
                    Text("A release note will appear here after this PR is merged.")
                        .font(.system(size: 10))
                        .foregroundStyle(UT.textTertiary)
                        .padding(.top, 3)
                }
            }
        } else {
            Text(notesError ?? "No notes are available for this PR.")
                .font(.system(size: 10))
                .foregroundStyle(UT.textTertiary)
        }
    }

    private func noteSection(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(UT.textTertiary)
                .textCase(.uppercase)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(UT.textBody)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Sets prTarget so RootView swaps in the popover Timeline in place.
    /// Falls back to opening the PR in the default browser if we can't
    /// build a full PRRef (e.g. missing org context).
    private func openTimeline() {
        guard let org = state.activeOrg, let repo = pr.repo, let n = pr.number else {
            if let u = URL(string: pr.displayUrl) { NSWorkspace.shared.open(u) }
            return
        }
        state.prTarget = PRRef(org: org, repo: repo, number: n, title: pr.title)
    }

    private func loadNotes() async {
        guard let repo = pr.repo, let number = pr.number else {
            notesError = "No notes are available for this PR."
            didLoadNotes = true
            return
        }
        isLoadingNotes = true
        defer { isLoadingNotes = false }
        do {
            let events = try await state.makeAPIClient().fetchEventsForPR(repo: repo, prNumber: number)
            openingNote = events.first(where: { $0.type == "pr_narrative" })?.summary
                .trimmingCharacters(in: .whitespacesAndNewlines)
            releaseNote = events.first(where: { $0.type == "release_notes" })?.summary
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if openingNote?.isEmpty == true { openingNote = nil }
            if releaseNote?.isEmpty == true { releaseNote = nil }
            if openingNote == nil && releaseNote == nil { notesError = "No notes are available for this PR." }
            didLoadNotes = true
        } catch {
            guard !Task.isCancelled else { return }
            notesError = error.userFacingDescription
            didLoadNotes = true
        }
    }
}

private struct IssueRow: View {
    let issue: Issue

    var body: some View {
        Button {
            if let u = URL(string: issue.displayUrl) { NSWorkspace.shared.open(u) }
        } label: {
            itemRow(
                icon: "circle",
                title: issue.displayTitle,
                repo: issue.displayRepo,
                number: issue.displayNumber,
                stateChip: nil,
                activity: nil,
                age: issue.displayUpdatedAt
            )
            .cardStyle()
        }
        .buttonStyle(.plain)
    }
}

private struct FeatureRow: View {
    let feature: NoxTicketFeature

    var body: some View {
        Button {
            if let raw = feature.htmlUrl, let url = URL(string: raw) { NSWorkspace.shared.open(url) }
        } label: {
            itemRow(
                icon: "sparkles",
                title: feature.title,
                repo: "Feature",
                number: feature.number,
                stateChip: feature.status.replacingOccurrences(of: "-", with: " ").capitalized,
                activity: nil,
                age: feature.updatedAt ?? ""
            )
            .cardStyle()
        }
        .buttonStyle(.plain)
        .help("Open this feature in GitHub")
    }
}

@ViewBuilder
private func itemRow(
    icon: String, title: String, repo: String, number: Int,
    stateChip: String?, activity: PRActivity?, age: String
) -> some View {
    HStack(alignment: .top, spacing: 8) {
        Image(systemName: icon).font(.system(size: 12)).foregroundStyle(UT.accent).padding(.top, 2)
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.system(size: 12, weight: .medium)).foregroundStyle(UT.textPrimary)
                .lineLimit(2).multilineTextAlignment(.leading)
            HStack(spacing: 6) {
                PillView(text: "\(repo) #\(number)", style: .accent)
                if let stateChip { PillView(text: stateChip, style: .mono) }
                if let activity { PillView(text: activity.badge, style: activityPillStyle(activity.kind)) }
                Spacer(minLength: 0)
                Text(DisplayDateFormatter.string(
                    for: activity?.date ?? DisplayDateFormatter.parse(age) ?? Date()
                ))
                    .font(.system(size: 10)).foregroundStyle(UT.textTertiary)
            }
            if let activity {
                Text(activity.title)
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textMuted)
                    .lineLimit(1)
            }
        }
    }
    .padding(.horizontal, 10).padding(.vertical, 8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(RoundedRectangle(cornerRadius: 8))
}

private func activityPillStyle(_ kind: PRActivity.Kind) -> PillStyle {
    switch kind {
    case .changesRequested: return .warn
    case .approved, .merged: return .success
    case .botReviewed: return .bronze
    case .draft, .closed: return .mono
    case .opened, .reviewRequested, .reviewed, .changesMade, .reopened: return .accent
    }
}
