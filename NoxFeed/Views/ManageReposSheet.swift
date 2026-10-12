import SwiftUI

struct ManageReposSheet: View {
    @EnvironmentObject private var state: AppState
    let onDone: () -> Void
    let showsHeader: Bool

    @State private var projects: [FeedProject] = []
    @State private var loading = true
    @State private var savingId: String?
    @State private var errorMessage: String?

    init(showsHeader: Bool = true, onDone: @escaping () -> Void = {}) {
        self.showsHeader = showsHeader
        self.onDone = onDone
    }

    var body: some View {
        VStack(spacing: 0) {
            if showsHeader {
                ManagementSheetHeader(title: "Tracked repositories", onDone: onDone)
                Divider().overlay(UT.border)
            }
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(UT.surface)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if loading {
            CenteredProgressView()
        } else if let err = errorMessage, projects.isEmpty {
            RetryErrorView(message: err) { Task { await load() } }
        } else {
            ScrollView {
                LazyVStack(spacing: 6) {
                    Text("Uncheck to hide a repo from the feed everywhere.")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 4)
                    ForEach(projects) { p in
                        RepoRow(
                            project: p,
                            saving: savingId == p.id,
                            onToggle: { Task { await toggle(p) } }
                        )
                    }
                }
                .padding(14)
            }
        }
    }

    private func load() async {
        loading = true; defer { loading = false }
        errorMessage = nil
        do {
            projects = try await state.makeAPIClient().fetchProjects()
                .filter { !($0.repo?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) }
                .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        } catch {
            errorMessage = error.userFacingDescription
        }
    }

    private func toggle(_ p: FeedProject) async {
        savingId = p.id
        defer { savingId = nil }
        let newArchived = !p.isArchived
        do {
            try await state.makeAPIClient().setProjectArchived(id: p.id, archived: newArchived)
            // Optimistically flip locally so the row updates instantly.
            if let idx = projects.firstIndex(where: { $0.id == p.id }) {
                projects[idx] = FeedProject(
                    id: p.id, name: p.name, slug: p.slug, repo: p.repo,
                    archived: newArchived ? 1 : 0
                )
            }
        } catch {
            errorMessage = error.userFacingDescription
        }
    }
}

private struct RepoRow: View {
    let project: FeedProject
    let saving: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "folder.fill")
                .foregroundStyle(project.isArchived ? UT.textTertiary : UT.accent)
                .font(.system(size: 12))
            VStack(alignment: .leading, spacing: 1) {
                Text(project.displayName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(project.isArchived ? UT.textMuted : UT.textPrimary)
                    .lineLimit(1)
                if project.isArchived {
                    Text("Hidden").font(.system(size: 10)).foregroundStyle(UT.textTertiary)
                }
            }
            Spacer()
            if saving {
                ProgressView().controlSize(.small)
            } else {
                Toggle("", isOn: Binding(
                    get: { !project.isArchived },
                    set: { _ in onToggle() }
                ))
                .toggleStyle(.switch)
                .controlSize(.mini)
                .labelsHidden()
                .tint(UT.accent)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .cardStyle()
    }
}
