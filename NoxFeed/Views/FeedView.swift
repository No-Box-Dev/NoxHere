import SwiftUI

struct FeedView: View {
    @Environment(\.openWindow) private var openWindow
    @EnvironmentObject private var state: AppState
    @EnvironmentObject private var notifier: NotifierStore
    @EnvironmentObject private var cache: TimelineCache
    @StateObject private var store = FeedStore()
    @StateObject private var searchStore = GlobalSearchStore()

    @State private var actorsById: [String: FeedActor] = [:]
    @State private var actorsByLogin: [String: FeedActor] = [:]
    @State private var projects: [FeedProject] = []
    @State private var showAddAccountSheet: Bool = false
    @State private var searchQuery: String = ""
    @State private var selectedSearchResultID: String?
    @State private var requestedPersonLogin: String?
    @State private var showActionsPopover = false
    @State private var refreshRequest = 0
    @State private var manualRefreshInProgress = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            if showAddAccountSheet {
                AddAccountSheet(onDone: { showAddAccountSheet = false })
                    .environmentObject(state)
            } else {
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(UT.surface)
        .task {
            await store.attach(clientProvider: { [weak state] in state?.makeAPIClient() }, cache: cache)
            await loadFilterOptions()
            if state.popoverOpen, store.mode.usesFeedStore { store.startPolling() }
        }
        .onChange(of: state.activeLogin) { _, _ in
            Task { await refreshEverything() }
        }
        .onChange(of: state.activeOrg) { _, _ in
            Task { await refreshEverything() }
        }
        .onChange(of: state.popoverOpen) { _, isOpen in
            if isOpen {
                resumeFeedPollingIfNeeded()
            } else {
                store.stopPolling()
            }
        }
        .onDisappear { store.stopPolling() }
        .task {
            try? await Task.sleep(for: .milliseconds(30))
            searchFocused = true
        }
        .task(id: normalizedSearchQuery) {
            await searchStore.search(query: searchQuery, client: state.makeAPIClient())
            if selectedSearchResultID == nil || !searchStore.results.contains(where: { $0.id == selectedSearchResultID }) {
                selectedSearchResultID = searchStore.results.first?.id
            }
        }
        .onMoveCommand { direction in
            guard !normalizedSearchQuery.isEmpty else { return }
            moveSearchSelection(direction)
        }
    }

    // MARK: - Header (with account/org switcher)

    private var header: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center) {
                Image(systemName: "list.bullet.rectangle.portrait.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(LinearGradient(colors: [UT.coral, UT.violet], startPoint: .topLeading, endPoint: .bottomTrailing))
                    )
                Text("NoxHere")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                AccountSwitcherButton(
                    accounts: state.visibleAccounts,
                    activeLogin: state.activeLogin,
                    orgsPerLogin: state.orgsPerLogin,
                    orgConnectionsPerLogin: state.orgConnectionsPerLogin,
                    activeOrg: state.activeOrg,
                    isAdmin: state.isAdmin,
                    isDemo: state.isDemoMode,
                    onPickOrg: { login, org in
                        state.switchToAccount(login: login)
                        state.selectOrg(org)
                    },
                    onAddAccount: { showAddAccountSheet = true },
                    onSignOut: { login in state.signOut(login: login) }
                )
                FilterMenu(
                    label: currentProjectLabel,
                    systemImage: "square.grid.2x2.fill",
                    items: projectOptions,
                    selectedId: store.projectId.isEmpty ? nil : store.projectId,
                    allLabel: "All repos",
                    onPick: { id in
                        store.projectId = id ?? ""
                        Task { await store.applyFilters() }
                    }
                )
                Spacer(minLength: 4)
                Button {
                    showActionsPopover.toggle()
                } label: {
                    Group {
                        if store.isRefreshing || manualRefreshInProgress {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            HStack(spacing: 3) {
                                Image(systemName: "ellipsis")
                                    .font(.system(size: 13, weight: .semibold))
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 8, weight: .semibold))
                            }
                        }
                    }
                    .foregroundStyle(UT.accent)
                    .frame(width: 38, height: 28)
                    .background(Capsule().fill(UT.accentSoft))
                    .overlay(Capsule().stroke(UT.accent.opacity(0.35), lineWidth: 0.75))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .fixedSize()
                .accessibilityLabel("Settings and actions")
                .help("Settings and actions")
                .popover(isPresented: $showActionsPopover, arrowEdge: .top) {
                    ActionsPopover(
                        onRefresh: {
                            showActionsPopover = false
                            requestManualRefresh()
                        },
                        onSettings: {
                            showActionsPopover = false
                            openWindow(id: "noxfeed-settings")
                            // `openWindow` is scheduled by SwiftUI. Keep the
                            // menu-bar scene alive through this run-loop turn so
                            // the request is not discarded with its originating
                            // view, then close the transient popover.
                            DispatchQueue.main.async {
                                state.popoverOpen = false
                                NSApplication.shared.activate(ignoringOtherApps: true)
                            }
                        },
                        onQuit: { NSApplication.shared.terminate(nil) }
                    )
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            if state.isDemoMode {
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                    Text("DEMO WORKSPACE")
                        .font(.system(size: 9, weight: .bold))
                    Text("Seeded data · Changes disabled")
                        .font(.system(size: 9))
                    Spacer()
                }
                .foregroundStyle(UT.warnText)
                .padding(.horizontal, 9)
                .frame(height: 24)
                .background(RoundedRectangle(cornerRadius: 6).fill(UT.warnBg).overlay(RoundedRectangle(cornerRadius: 6).stroke(UT.warnBorder)))
                .accessibilityLabel("Demo workspace. Seeded data. Changes are disabled.")
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
            }
            searchBar
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
            ModePicker(mode: $store.mode) { modeChanged() }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
        }
        .background(UT.surface)
        .overlay(alignment: .bottom) { Divider().overlay(UT.border) }
    }

    private var searchBar: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(UT.textTertiary)
            TextField("", text: $searchQuery, prompt: Text("Search activity").foregroundStyle(UT.textTertiary))
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .tint(UT.accent)
                .focused($searchFocused)
                .onSubmit { openSelectedSearchResult() }
            if !searchQuery.isEmpty {
                Button { searchQuery = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(UT.textTertiary)
                }
                .buttonStyle(.plain)
                .help("Clear search")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 34)
        .background(RoundedRectangle(cornerRadius: 8).fill(UT.card))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(UT.border, lineWidth: 1))
    }

    private var hasActiveFilters: Bool {
        !store.projectId.isEmpty
    }

    private var projectOptions: [FilterMenuItem] {
        projects
            .filter(\.isTrackedRepository)
            .map { FilterMenuItem(id: $0.id, label: $0.repositoryDisplayName) }
    }

    private var currentProjectLabel: String {
        if store.projectId.isEmpty { return "All repos" }
        return projects.first { $0.id == store.projectId }?.repositoryDisplayName ?? "Repo"
    }

    private var selectedProject: FeedProject? {
        guard !store.projectId.isEmpty else { return nil }
        return projects.first { $0.id == store.projectId }
    }

    private var normalizedSearchQuery: String {
        searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if !normalizedSearchQuery.isEmpty {
            GlobalSearchView(
                query: searchQuery.trimmingCharacters(in: .whitespacesAndNewlines),
                results: searchStore.results,
                isLoading: searchStore.isLoading,
                errorMessage: searchStore.errorMessage,
                selectedID: selectedSearchResultID,
                onSelect: openSearchResult,
                onRetry: { Task { await searchStore.search(query: searchQuery, client: state.makeAPIClient()) } }
            )
        } else if store.mode == .current {
            CurrentView(
                repository: selectedProject?.repo,
                requestedLogin: requestedPersonLogin,
                refreshRequest: refreshRequest,
                onRefreshFinished: { manualRefreshInProgress = false }
            )
                .environmentObject(state)
        } else if store.mode == .issues {
            IssuesView(
                repository: selectedProject?.repo,
                refreshRequest: refreshRequest,
                onRefreshFinished: { manualRefreshInProgress = false }
            )
                .environmentObject(state)
        } else if store.isLoading && store.events.isEmpty {
            CenteredProgressView()
        } else if let err = store.errorMessage, store.events.isEmpty {
            RetryErrorView(message: err) { Task { await store.refresh() } }
        } else if store.events.isEmpty {
            Group {
                if hasActiveFilters {
                    EmptyStateCard(text: "No \(store.mode.label.lowercased()) match the current filters.")
                } else {
                    ConnectedEmptyState(message: emptyLine, org: state.activeOrg)
                }
            }
            .padding(14)
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(store.events) { event in
                        PostCard(event: event, actor: actorFor(event))
                    }
                    if store.canLoadMore {
                        Button {
                            Task { await store.loadMore() }
                        } label: {
                            Text("Load more")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(UT.textMuted)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(Capsule().fill(UT.card).overlay(Capsule().stroke(UT.border)))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 4)
                    }
                }
                .padding(14)
            }
        }
    }

    private var emptyLine: String {
        switch store.mode {
        case .posts: return "No merged updates yet. As people merge PRs, their updates will appear here."
        case .releaseNotes: return "No release notes yet. Structured release notes will appear here as PRs get merged."
        case .opened: return "No opened PRs yet. First-person opened-PR posts will appear here."
        case .current: return ""  // Current mode routes to CurrentView; this string is never shown.
        case .issues: return ""  // Issues mode routes to IssuesView; this string is never shown.
        }
    }

    // MARK: - Loading

    private func modeChanged() {
        store.stopPolling()
        guard store.mode.usesFeedStore else {
            Task { await store.applyFilters() }
            return
        }
        Task {
            await store.applyFilters()
            if state.popoverOpen, store.mode.usesFeedStore { store.startPolling() }
        }
    }

    private func resumeFeedPollingIfNeeded() {
        guard store.mode.usesFeedStore else {
            store.stopPolling()
            return
        }
        Task {
            await store.refresh()
            if state.popoverOpen, store.mode.usesFeedStore { store.startPolling() }
        }
    }

    private func requestManualRefresh() {
        guard !manualRefreshInProgress else { return }
        manualRefreshInProgress = true
        refreshRequest &+= 1
        if store.mode != .current && store.mode != .issues {
            Task {
                await store.refreshNow()
                manualRefreshInProgress = false
            }
        }
    }

    private func refreshEverything() async {
        // Scope (login/org) changed — drop everything cached + displayed for
        // the old one.
        cache.invalidate()
        searchStore.resetScope()
        searchQuery = ""
        selectedSearchResultID = nil
        requestedPersonLogin = nil
        store.scopeChanged()
        store.actorId = ""
        store.projectId = ""
        await loadFilterOptions()
        await store.applyFilters()
    }

    private func loadFilterOptions() async {
        guard let scopeLogin = state.activeLogin,
              let scopeOrg = state.activeOrg else { return }
        let client = state.makeAPIClient()
        async let p = try? await client.fetchProjects()
        // Actors are shared with TimelineStore via TimelineCache; reuse when
        // fresh instead of re-fetching the org-wide list (which also primes
        // the cache before the user opens any PR).
        if let cached = cache.cachedActors() {
            setActors(cached)
        } else if let fetched = try? await client.fetchActors() {
            guard state.activeLogin == scopeLogin,
                  state.activeOrg == scopeOrg else { return }
            cache.setActors(fetched)
            setActors(fetched)
        }
        let fetchedProjects = await p
        guard state.activeLogin == scopeLogin,
              state.activeOrg == scopeOrg else { return }
        if let fetchedProjects {
            projects = fetchedProjects.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        }
    }

    private func moveSearchSelection(_ direction: MoveCommandDirection) {
        guard direction == .up || direction == .down, !searchStore.results.isEmpty else { return }
        let current = searchStore.results.firstIndex { $0.id == selectedSearchResultID } ?? 0
        let offset = direction == .down ? 1 : -1
        selectedSearchResultID = searchStore.results[min(max(current + offset, 0), searchStore.results.count - 1)].id
    }

    private func openSelectedSearchResult() {
        guard let selectedSearchResultID,
              let result = searchStore.results.first(where: { $0.id == selectedSearchResultID }) else { return }
        openSearchResult(result)
    }

    private func openSearchResult(_ result: GlobalSearchResult) {
        if result.kind == .person, let login = result.personLogin {
            requestedPersonLogin = login
            store.mode = .current
            searchQuery = ""
            return
        }
        if let repo = result.repo, let number = result.number,
           result.kind == .pullRequest || result.kind == .post || result.kind == .releaseNote,
           let org = state.activeOrg {
            state.prTarget = PRRef(org: org, repo: repo, number: number, title: result.title)
            return
        }
        if let rawURL = result.url, let url = URL(string: rawURL) {
            NSWorkspace.shared.open(url)
        }
    }

    private func setActors(_ loaded: [FeedActor]) {
        actorsById = loaded.reduce(into: [:]) { $0[$1.id] = $1 }
        actorsByLogin = loaded.reduce(into: [:]) { index, actor in
            if let login = actor.githubLogin?.lowercased() { index[login] = actor }
        }
    }

    /// Two-step lookup: `event.actor_id` first (fastest, most specific),
    /// then payload author login as a fallback. Same user across multiple
    /// events sometimes has actor_id populated on one and null on another
    /// (differences in how each narrator was triggered) — without the
    /// login fallback the same person's avatar shows up on one card and
    /// falls back to initials on the next.
    private func actorFor(_ event: FeedEvent) -> FeedActor? {
        if let id = event.actorId, let match = actorsById[id] {
            return match
        }
        if let login = event.payload?.authorLogin?.lowercased(), !login.isEmpty {
            return actorsByLogin[login]
        }
        return nil
    }

}

// MARK: - Small parts (filter primitives + empty state)

private struct ActionsPopover: View {
    let onRefresh: () -> Void
    let onSettings: () -> Void
    let onQuit: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 2) {
                ActionRow(
                    title: "Refresh",
                    systemImage: "arrow.clockwise",
                    action: onRefresh
                )
                ActionRow(
                    title: "Settings…",
                    systemImage: "gearshape",
                    shortcut: "⌘,",
                    action: onSettings
                )
                Divider().overlay(UT.borderSoft).padding(.vertical, 3)
                ActionRow(
                    title: "Quit NoxHere",
                    systemImage: "power",
                    action: onQuit
                )
            }
            .padding(6)
        }
        .frame(width: 190)
        .background(UT.card)
    }
}

private struct ActionRow: View {
    let title: String
    let systemImage: String
    var shortcut: String? = nil
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(UT.accent)
                    .frame(width: 16)
                Text(title)
                    .font(.system(size: 13))
                    .foregroundStyle(UT.textPrimary)
                Spacer(minLength: 8)
                if let shortcut {
                    Text(shortcut)
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textTertiary)
                }
            }
            .padding(.horizontal, 9)
            .frame(height: 32)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 7)
                    .fill(isHovered ? UT.accentSoft : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .accessibilityLabel(title)
    }
}

private struct FilterMenuItem: Identifiable, Hashable {
    let id: String
    let label: String
}

private struct FilterMenu: View {
    let label: String
    let systemImage: String
    let items: [FilterMenuItem]
    let selectedId: String?
    var allLabel: String = "All"
    let onPick: (String?) -> Void

    var body: some View {
        Menu {
            Button {
                onPick(nil)
            } label: {
                if selectedId == nil {
                    Label(allLabel, systemImage: "checkmark")
                } else {
                    Text(allLabel)
                }
            }
            Divider()
            ForEach(items) { item in
                Button {
                    onPick(item.id)
                } label: {
                    if selectedId == item.id {
                        Label(item.label, systemImage: "checkmark")
                    } else {
                        Text(item.label)
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: systemImage).font(.system(size: 9)).foregroundStyle(UT.textMuted)
                Text(label).font(.system(size: 11, weight: .medium)).foregroundStyle(UT.textBody).lineLimit(1)
                Image(systemName: "chevron.down").font(.system(size: 8)).foregroundStyle(UT.textTertiary)
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
            .cardStyle(cornerRadius: 6)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }
}

struct ModePicker: View {
    @Binding var mode: FeedMode
    let onChange: () -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(FeedMode.allCases) { m in
                Button {
                    mode = m
                    onChange()
                } label: {
                    Text(m.label)
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.9)
                        .foregroundStyle(mode == m ? UT.accent : UT.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 5)
                                .fill(mode == m ? UT.accentSoft : Color.clear)
                        )
                        // Without this, SwiftUI hit-tests only where the
                        // label draws opaque pixels — i.e. the letters
                        // themselves. Rectangle() makes the entire framed
                        // button click-through.
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .cardStyle(cornerRadius: 7)
    }
}

struct EmptyStateCard: View {
    let text: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 22))
                .foregroundStyle(UT.textTertiary)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(UT.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .cardStyle(cornerRadius: 12)
    }
}

/// A successful empty state. RootView keeps disconnected organizations out of
/// FeedView, so reaching this view means NoxConnect is installed and there is
/// simply no matching activity yet.
private struct ConnectedEmptyState: View {
    let message: String
    let org: String?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 22))
                .foregroundStyle(UT.textTertiary)
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(UT.textMuted)
                .multilineTextAlignment(.center)

            if let org {
                VStack(spacing: 4) {
                    Label("Connected to \(org)", systemImage: "checkmark.circle.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.green)
                    Text("NoxConnect is ready. New pull-request activity will appear automatically.")
                        .font(.system(size: 10))
                        .foregroundStyle(UT.textTertiary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .cardStyle(cornerRadius: 12)
    }
}
