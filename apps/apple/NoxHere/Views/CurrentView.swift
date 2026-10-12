import SwiftUI

/// Current work for the signed-in user or another organization member.
struct CurrentView: View {
    var searchQuery: String = ""
    var repository: String?
    var requestedLogin: String?
    var refreshRequest: Int = 0
    var onRefreshFinished: () -> Void = {}

    @EnvironmentObject private var state: AppState
    @EnvironmentObject private var cache: TimelineCache
    @StateObject private var store = MeStore()
    @StateObject private var membersStore = CurrentMembersStore()

    @State private var mode: PageMode = .initial

    private enum PageMode { case initial, person(String), list }

    private static func lastViewKey(for login: String) -> String {
        "planning-feed.currentView.\(login)"
    }

    private static func readLast(for login: String) -> PageMode? {
        guard let raw = UserDefaults.standard.string(forKey: lastViewKey(for: login)) else { return nil }
        if raw == "list" { return .list }
        if raw.hasPrefix("person:") {
            let name = String(raw.dropFirst("person:".count))
            return name.isEmpty ? nil : .person(name)
        }
        return nil
    }

    private static func writeLast(_ mode: PageMode, for login: String) {
        let raw: String?
        switch mode {
        case .list: raw = "list"
        case .person(let name): raw = "person:\(name)"
        case .initial: raw = nil
        }
        if let raw { UserDefaults.standard.set(raw, forKey: lastViewKey(for: login)) }
    }

    var body: some View {
        Group {
            switch mode {
            case .initial:
                CenteredProgressView()
            case .person(let login):
                PersonView(
                    login: login,
                    store: store,
                    searchQuery: searchQuery,
                    repository: repository,
                    onBack: openList
                )
            case .list:
                PeopleList(
                    members: filteredMembers,
                    searchQuery: searchQuery,
                    stats: membersStore.stats,
                    error: membersStore.errorMessage,
                    isLoading: membersStore.isLoading,
                    hasLoaded: membersStore.hasLoaded,
                    activeLogin: state.activeLogin,
                    onPick: openPerson,
                    onRetry: { Task { await loadMembers() } }
                )
            }
        }
        .task {
            store.attach(clientProvider: { [weak state] in state?.makeAPIClient() }, cache: cache)
            if let requestedLogin {
                openPerson(requestedLogin)
            } else {
                await enterDefault()
            }
        }
        .onChange(of: state.activeLogin) { _, _ in Task { await enterDefault() } }
        .onChange(of: state.activeOrg) { _, _ in
            Task { await loadMembers(); await enterDefault() }
        }
        .onChange(of: state.popoverOpen) { _, isOpen in
            if isOpen {
                Task { await resumeVisibleContent() }
            } else {
                store.stopPolling()
            }
        }
        .onChange(of: refreshRequest) { _, _ in
            Task {
                switch mode {
                case .person:
                    await store.refresh()
                case .list:
                    await loadMembers()
                case .initial:
                    await enterDefault()
                }
                onRefreshFinished()
            }
        }
        .task(id: listPollingKey) {
            guard isListMode, state.popoverOpen else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(60)) }
                catch { return }
                await loadMembers()
            }
        }
        .onDisappear { store.stopPolling() }
    }

    private var isListMode: Bool {
        if case .list = mode { return true }
        return false
    }

    private var listPollingKey: String {
        "\(isListMode)/\(state.popoverOpen)/\(state.activeLogin ?? "")/\(state.activeOrg ?? "")"
    }

    private func resumeVisibleContent() async {
        switch mode {
        case .person:
            await store.refresh()
            if state.popoverOpen { store.startPolling() }
        case .list:
            await loadMembers()
        case .initial:
            await enterDefault()
        }
    }

    private func enterDefault() async {
        guard let login = state.activeLogin else {
            mode = .list
            await loadMembers()
            return
        }
        switch Self.readLast(for: login) ?? .person(login) {
        case .list:
            mode = .list
            await loadMembers()
        case .person(let target):
            mode = .person(target)
            Self.writeLast(.person(target), for: login)
            await store.setLogin(target)
            if state.popoverOpen { store.startPolling() }
        case .initial:
            break
        }
    }

    private func openList() {
        Task {
            store.stopPolling()
            mode = .list
            if let login = state.activeLogin { Self.writeLast(.list, for: login) }
            await loadMembers()
        }
    }

    private func openPerson(_ target: String) {
        Task {
            mode = .person(target)
            if let login = state.activeLogin { Self.writeLast(.person(target), for: login) }
            await store.setLogin(target)
            if state.popoverOpen { store.startPolling() }
        }
    }

    private func loadMembers() async {
        await membersStore.load(
            client: state.makeAPIClient(),
            scope: .init(login: state.activeLogin, org: state.activeOrg)
        )
    }

    private var visibleMembers: [APIClient.OrgMember] {
        membersStore.excludedMembers.isEmpty
            ? membersStore.members
            : membersStore.members.filter { !membersStore.excludedMembers.contains($0.login) }
    }

    private var filteredMembers: [APIClient.OrgMember] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return visibleMembers }
        return visibleMembers.filter { member in
            member.login.localizedCaseInsensitiveContains(query)
        }
    }
}
