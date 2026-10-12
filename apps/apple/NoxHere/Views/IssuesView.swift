import SwiftUI

/// Organization-wide issue triage, following Planning's Issues tab structure:
/// scope and state controls, people/repository buckets, critical visibility,
/// then a compact drill-down list.
struct IssuesView: View {
    var repository: String?
    var refreshRequest: Int
    var onRefreshFinished: () -> Void

    private let loadsRemoteData: Bool

    @EnvironmentObject private var state: AppState
    @StateObject private var store = IssuesStore()
    @State private var scope: IssueScope = .all
    @State private var status: IssueStatus = .open
    @State private var groupBy: IssueGrouping = .people
    @State private var selectedBucket: String?

    private let staleDays = 30
    private let pollInterval = Duration.seconds(60)

    init(
        repository: String? = nil,
        refreshRequest: Int = 0,
        onRefreshFinished: @escaping () -> Void = {}
    ) {
        self.repository = repository
        self.refreshRequest = refreshRequest
        self.onRefreshFinished = onRefreshFinished
        self.loadsRemoteData = true
    }

    #if DEBUG
    init(previewIssues: [Issue], previewMembers: [APIClient.OrgMember]) {
        self.repository = nil
        self.refreshRequest = 0
        self.onRefreshFinished = {}
        self.loadsRemoteData = false
        _store = StateObject(wrappedValue: IssuesStore(issues: previewIssues, members: previewMembers))
    }
    #endif

    var body: some View {
        VStack(spacing: 0) {
            controls
            Divider().overlay(UT.border)
            content
        }
        .task(id: pollingKey) {
            guard loadsRemoteData, state.popoverOpen else { return }
            selectedBucket = nil
            while !Task.isCancelled {
                await refresh()
                do { try await Task.sleep(for: pollInterval) }
                catch { return }
            }
        }
        .onChange(of: status) { _, _ in selectedBucket = nil }
        .onChange(of: groupBy) { _, _ in selectedBucket = nil }
        .onChange(of: scope) { _, _ in selectedBucket = nil }
        .onChange(of: refreshRequest) { _, _ in
            Task {
                await refresh()
                onRefreshFinished()
            }
        }
    }

    private var pollingKey: String {
        "\(state.activeLogin ?? "")/\(state.activeOrg ?? "")/\(repository ?? "")/\(status.rawValue)/\(state.popoverOpen)"
    }

    private func refresh() async {
        await store.refresh(client: state.makeAPIClient(), status: status, repository: repository)
    }

    private var visibleIssues: [Issue] {
        guard scope == .me, let login = state.activeLogin else { return store.issues }
        return store.issues.filter { issue in
            issue.assignedPeople.contains { $0.login.caseInsensitiveCompare(login) == .orderedSame }
        }
    }

    private var criticalIssues: [Issue] {
        status == .open ? visibleIssues.filter(\.isCritical) : []
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                IssueSegment(selection: $scope, options: IssueScope.allCases)
                IssueSegment(selection: $status, options: IssueStatus.allCases)
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                IssueSegment(selection: $groupBy, options: IssueGrouping.allCases)
                Spacer(minLength: 6)
                if store.isLoading {
                    ProgressView().controlSize(.small).tint(UT.accent)
                } else {
                    Text("\(visibleIssues.count) \(status.label.lowercased()) issue\(visibleIssues.count == 1 ? "" : "s")")
                        .font(.system(size: 10))
                        .foregroundStyle(UT.textTertiary)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(UT.surface)
    }

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.issues.isEmpty {
            CenteredProgressView()
        } else if let error = store.errorMessage, store.issues.isEmpty {
            RetryErrorView(message: error) { Task { await refresh() } }
        } else if let selectedBucket {
            issueList(for: selectedBucket)
        } else {
            overview
        }
    }

    private var overview: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                if !criticalIssues.isEmpty { criticalBanner }
                if buckets.isEmpty {
                    EmptyStateCard(text: "No \(status.label.lowercased()) issues in this scope.")
                } else {
                    ForEach(buckets) { bucket in
                        IssueBucketCard(bucket: bucket, groupBy: groupBy) {
                            selectedBucket = bucket.id
                        }
                    }
                }
            }
            .padding(14)
        }
    }

    private var criticalBanner: some View {
        HStack(spacing: 9) {
            Image(systemName: "flag.fill")
                .font(.system(size: 12))
                .foregroundStyle(Color.red)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.red.opacity(0.10)))
            VStack(alignment: .leading, spacing: 2) {
                Text("\(criticalIssues.count) critical issue\(criticalIssues.count == 1 ? "" : "s") open")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.red)
                    .textCase(.uppercase)
                Text(criticalIssues.prefix(3).map { "\($0.displayRepo) #\($0.displayNumber)" }.joined(separator: " · "))
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(Color.red.opacity(0.055))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color.red.opacity(0.28)))
        )
    }

    private func issueList(for bucketID: String) -> some View {
        let matching = issues(in: bucketID)
        return VStack(spacing: 0) {
            HStack(spacing: 7) {
                Button {
                    selectedBucket = nil
                } label: {
                    Label("All issues", systemImage: "chevron.left")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(UT.accent)
                }
                .buttonStyle(.plain)
                Spacer()
                Text(bucketTitle(bucketID))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                Spacer()
                Text(String(matching.count))
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(UT.textMuted)
                    .frame(minWidth: 58, alignment: .trailing)
            }
            .padding(.horizontal, 14)
            .frame(height: 38)
            .background(UT.card)
            Divider().overlay(UT.border)
            if matching.isEmpty {
                EmptyStateCard(text: "No \(status.label.lowercased()) issues here.")
                    .padding(14)
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(matching) { issue in IssueListRow(issue: issue, staleDays: staleDays) }
                    }
                    .padding(14)
                }
            }
        }
    }

    private var buckets: [IssueBucket] {
        var grouped: [String: [Issue]] = [:]
        var avatars: [String: String?] = [:]

        if groupBy == .people {
            let members = scope == .me
                ? store.members.filter { $0.login.caseInsensitiveCompare(state.activeLogin ?? "") == .orderedSame }
                : store.members
            for member in members {
                grouped[member.login, default: []] = []
                avatars[member.login] = member.avatarUrl
            }
            for issue in visibleIssues {
                if issue.assignedPeople.isEmpty {
                    grouped[IssueBucket.unassigned, default: []].append(issue)
                } else {
                    for assignee in issue.assignedPeople {
                        grouped[assignee.login, default: []].append(issue)
                        if avatars[assignee.login] == nil { avatars[assignee.login] = assignee.avatarUrl }
                    }
                }
            }
        } else {
            if let repository { grouped[repository, default: []] = [] }
            for issue in visibleIssues { grouped[issue.displayRepo, default: []].append(issue) }
        }

        return grouped.map { key, issues in
            IssueBucket(
                id: key,
                title: key == IssueBucket.unassigned ? "Unassigned" : key,
                avatarURL: avatars[key] ?? nil,
                issues: issues,
                staleDays: staleDays
            )
        }.sorted { lhs, rhs in
            if lhs.id == IssueBucket.unassigned { return true }
            if rhs.id == IssueBucket.unassigned { return false }
            if lhs.count == 0, rhs.count > 0 { return false }
            if rhs.count == 0, lhs.count > 0 { return true }
            if lhs.count != rhs.count { return lhs.count > rhs.count }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private func issues(in bucketID: String) -> [Issue] {
        visibleIssues.filter { issue in
            if groupBy == .repo { return issue.displayRepo == bucketID }
            if bucketID == IssueBucket.unassigned { return issue.assignedPeople.isEmpty }
            return issue.assignedPeople.contains { $0.login.caseInsensitiveCompare(bucketID) == .orderedSame }
        }.sorted { $0.displayUpdatedAt > $1.displayUpdatedAt }
    }

    private func bucketTitle(_ id: String) -> String {
        id == IssueBucket.unassigned ? "Unassigned" : groupBy == .people ? "@\(id)" : id
    }
}
