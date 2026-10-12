import SwiftUI

@MainActor
private final class MobileCurrentModel: ObservableObject {
    @Published var pullRequests: [PullRequest] = []
    @Published var issues: [Issue] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load(client: APIClient, login: String) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let prs = client.fetchMyPRs(login: login)
            async let assigned = client.fetchMyIssues(login: login)
            (pullRequests, issues) = try await (prs, assigned)
        } catch {
            errorMessage = error.userFacingDescription
        }
    }
}

struct MobileCurrentView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.openURL) private var openURL
    @StateObject private var model = MobileCurrentModel()

    var body: some View {
        List {
            if let error = model.errorMessage, model.pullRequests.isEmpty && model.issues.isEmpty {
                ContentUnavailableView("Couldn’t load current work", systemImage: "wifi.exclamationmark", description: Text(error))
            }

            if !model.pullRequests.isEmpty {
                Section("My pull requests") {
                    ForEach(model.pullRequests) { pr in
                        Button { open(pr.displayUrl) } label: {
                            WorkItemRow(
                                title: pr.displayTitle,
                                context: "\(pr.displayRepo) #\(pr.displayNumber)",
                                date: pr.displayUpdatedAt,
                                icon: pr.isDraft ? "pencil.and.outline" : "arrow.branch"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if !model.issues.isEmpty {
                Section("Assigned issues") {
                    ForEach(model.issues) { issue in
                        Button { open(issue.displayUrl) } label: {
                            WorkItemRow(
                                title: issue.displayTitle,
                                context: "\(issue.displayRepo) #\(issue.displayNumber)",
                                date: issue.displayUpdatedAt,
                                icon: "record.circle"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if !model.isLoading && model.errorMessage == nil && model.pullRequests.isEmpty && model.issues.isEmpty {
                ContentUnavailableView("Nothing assigned", systemImage: "checkmark.circle")
            }
        }
        .navigationTitle("Current")
        .overlay { if model.isLoading && model.pullRequests.isEmpty { ProgressView() } }
        .task(id: "\(state.activeLogin ?? "")/\(state.activeOrg ?? "")") {
            guard let login = state.activeLogin else { return }
            await model.load(client: state.makeAPIClient(), login: login)
        }
        .refreshable {
            guard let login = state.activeLogin else { return }
            await model.load(client: state.makeAPIClient(), login: login)
        }
    }

    private func open(_ raw: String) {
        if let url = URL(string: raw) { openURL(url) }
    }
}

private struct WorkItemRow: View {
    let title: String
    let context: String
    let date: String
    let icon: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(MobileTheme.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.medium)).foregroundStyle(.primary)
                HStack {
                    Text(context)
                    if let parsed = DisplayDateFormatter.parse(date) {
                        Text(DisplayDateFormatter.string(for: parsed))
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}
