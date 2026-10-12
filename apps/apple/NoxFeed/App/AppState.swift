import Foundation
import Combine

/// Root app state. Two phases only — signedOut and ready. Backed by
/// AccountsStore for multi-account support; every derived field
/// (orgs, isAdmin, me-avatar) tracks the ACTIVE account.
@MainActor
final class AppState: ObservableObject {
    enum Phase { case signedOut, ready }

    @Published var phase: Phase = .signedOut
    @Published var accounts: AccountsStore
    @Published private(set) var demoSession: DemoSession?
    @Published var orgsPerLogin: [String: [String]] = [:]   // login → GitHub orgs
    /// Per-organization installation state. Missing means not checked yet;
    /// false means the user belongs to the org but NoxConnect is not installed.
    @Published var orgConnectionsPerLogin: [String: [String: Bool]] = [:]
    @Published var isAdmin: Bool = false
    @Published var lastError: String?
    /// Bound to the MenuBarExtra popover via MenuBarExtraAccess so the
    /// global hotkey (⌘⇧X by default) can programmatically toggle it.
    @Published var popoverOpen: Bool = false
    /// When non-nil, RootView renders PRDetailView instead of the feed.
    /// Set by clicking a PR anywhere in the popover; cleared by the back
    /// button in PRDetailView.
    @Published var prTarget: PRRef?

    private var cancellables = Set<AnyCancellable>()
    private var bootstrapTask: Task<Void, Never>?
    private var membershipTask: Task<Void, Never>?

    init() {
        self.accounts = AccountsStore()
        AuthService.shared.bind(self.accounts)
        recomputePhase()

        // React to account list / active login changes.
        self.accounts.$activeLogin
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard self?.isDemoMode != true else { return }
                self?.recomputePhase()
                self?.bootstrapActive()
                self?.loadMembership()
            }
            .store(in: &cancellables)

        self.accounts.$accounts
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.recomputePhase() }
            .store(in: &cancellables)

        if accounts.activeAccount != nil { bootstrapActive() }
    }

    // MARK: - Derived active-account state

    var isDemoMode: Bool { demoSession != nil }

    var activeLogin: String? { demoSession?.account.login ?? accounts.activeLogin }

    var activeAccount: Account? {
        if let demoSession {
            return Account(
                login: demoSession.account.login,
                avatarUrl: demoSession.account.avatarUrl,
                selectedOrg: demoSession.organization.login
            )
        }
        return accounts.activeAccount
    }

    var visibleAccounts: [Account] {
        if let activeAccount, isDemoMode { return [activeAccount] }
        return accounts.accounts
    }

    var activeOrg: String? { activeAccount?.selectedOrg }

    var activeOrgs: [String] {
        guard let login = activeLogin else { return [] }
        return orgsPerLogin[login] ?? []
    }

    var activeWorkspaces: [GitHubWorkspace] {
        guard let login = activeLogin else { return [] }
        return GitHubWorkspaceSelection.workspaces(login: login, organizations: activeOrgs)
    }

    var activeWorkspace: GitHubWorkspace? {
        guard let selected = activeOrg else { return nil }
        return activeWorkspaces.first {
            $0.login.caseInsensitiveCompare(selected) == .orderedSame
        }
    }

    var activeWorkspaceIsPersonal: Bool { activeWorkspace?.kind == .personal }

    var activeOrgIsConnected: Bool {
        guard let login = activeLogin, let org = activeOrg else { return false }
        return orgConnectionsPerLogin[login]?[org.lowercased()] == true
    }

    var activeOrganizationStatusIsLoaded: Bool {
        guard let login = activeLogin else { return false }
        guard let org = activeOrg else { return orgsPerLogin[login] != nil }
        return orgConnectionsPerLogin[login]?[org.lowercased()] != nil
    }

    func recomputePhase() {
        phase = (activeLogin != nil) ? .ready : .signedOut
    }

    // MARK: - Account actions

    func signOutActive() {
        if isDemoMode {
            exitDemo()
            return
        }
        guard let login = accounts.activeLogin else { return }
        let refreshToken = accounts.refreshToken(for: login)
        accounts.signOut(login: login)
        if let refreshToken { Task { await AuthService.shared.revokeSession(refreshToken: refreshToken) } }
        isAdmin = false
    }

    func signOut(login: String) {
        if isDemoMode, login == activeLogin {
            exitDemo()
            return
        }
        let wasActive = login == accounts.activeLogin
        let refreshToken = accounts.refreshToken(for: login)
        accounts.signOut(login: login)
        if let refreshToken { Task { await AuthService.shared.revokeSession(refreshToken: refreshToken) } }
        if wasActive { isAdmin = false }
    }

    func selectOrg(_ org: String?) {
        if isDemoMode { return }
        guard let login = accounts.activeLogin else { return }
        lastError = nil
        accounts.setSelectedOrg(org, for: login)
        loadMembership()
        if let org {
            Task { await refreshConnectionStatus(login: login, org: org) }
        }
    }

    func switchToAccount(login: String) {
        if isDemoMode { return }
        accounts.setActive(login: login)
    }

    func enterDemo() async throws {
        let session = try await DemoSessionService.start()
        bootstrapTask?.cancel()
        membershipTask?.cancel()
        demoSession = session
        let login = session.account.login
        let org = session.organization.login
        orgsPerLogin[login] = [org]
        orgConnectionsPerLogin[login] = [org.lowercased(): true]
        isAdmin = true
        lastError = nil
        prTarget = nil
        recomputePhase()
    }

    func exitDemo() {
        guard let session = demoSession else { return }
        let login = session.account.login
        demoSession = nil
        orgsPerLogin.removeValue(forKey: login)
        orgConnectionsPerLogin.removeValue(forKey: login)
        isAdmin = false
        lastError = nil
        prTarget = nil
        recomputePhase()
        if accounts.activeAccount != nil {
            bootstrapActive()
            loadMembership()
        }
    }

    // MARK: - APIClient factory

    /// Capture one immutable login/org scope. Token reads remain lazy so a
    /// refresh can rotate credentials without mixing accounts.
    func makeAPIClient() -> APIClient {
        if let demoSession {
            return APIClient(
                baseURL: Config.demoAPIBase,
                token: { [weak self] in self?.demoSession?.accessToken },
                org: demoSession.organization.login
            )
        }
        let login = accounts.activeLogin
        let org = activeOrg
        return APIClient(
            token: { [weak self] in
                guard let login else { return nil }
                return self?.accounts.accessToken(for: login)
            },
            org: org,
            refresh: { [weak self] in
                guard self != nil, let login else { return false }
                return await AuthService.shared.refreshIfPossible(login: login)
            }
        )
    }

    // MARK: - Bootstrap

    /// After the active account changes, fetch GitHub identity + orgs through
    /// NoxConnect. NoxHere never calls GitHub directly.
    /// If the org selection was empty (or now-inaccessible), auto-pick the
    /// first available.
    private func bootstrapActive() {
        bootstrapTask?.cancel()
        guard let login = accounts.activeLogin else { return }

        // Handle the legacy-migration placeholder: we recovered tokens but
        // don't yet know the login. Ask GitHub, then rename the account.
        let isPlaceholder = login == "__pending__"

        bootstrapTask = Task { [weak self] in
            guard let self else { return }
            guard await AuthService.shared.ensureNoxSession(login: login) else {
                guard !Task.isCancelled, self.accounts.activeLogin == login else { return }
                self.lastError = "NoxHere couldn't secure this existing session. Sign in again to continue."
                return
            }
            let client = self.makeAPIClient()
            let profile: APIClient.NoxConnectProfile
            do {
                profile = try await client.fetchGitHubProfile()
            } catch {
                guard !Task.isCancelled, self.accounts.activeLogin == login else { return }
                self.lastError = error.userFacingDescription
                return
            }
            let me = profile.user
            guard !Task.isCancelled, self.accounts.activeLogin == login else { return }
            self.lastError = nil

            if isPlaceholder {
                // Rewrite tokens under the real login, then let the
                // subsequent activeLogin change re-trigger bootstrap.
                self.accounts.promotePlaceholderIfNeeded(realLogin: me.login, avatarUrl: me.avatarUrl)
                return
            }

            await self.applyOrganizations(profile.orgs, login: login)
        }
    }

    func refreshOrganizations() async {
        if let demoSession {
            let login = demoSession.account.login
            let org = demoSession.organization.login
            orgsPerLogin[login] = [org]
            orgConnectionsPerLogin[login] = [org.lowercased(): true]
            lastError = nil
            return
        }
        guard let login = accounts.activeLogin else { return }
        let client = makeAPIClient()
        let profile: APIClient.NoxConnectProfile
        do {
            profile = try await client.fetchGitHubProfile()
        } catch {
            guard accounts.activeLogin == login else { return }
            lastError = error.userFacingDescription
            return
        }
        guard accounts.activeLogin == login else { return }
        lastError = nil
        await applyOrganizations(profile.orgs, login: login)
    }

    private func applyOrganizations(_ organizations: [APIClient.GitHubOrgLite], login: String) async {
        let names = organizations.map(\.login).sorted { $0.lowercased() < $1.lowercased() }
        orgsPerLogin[login] = names
        let selection = GitHubWorkspaceSelection.resolvedSelection(
            current: activeOrg,
            login: login,
            organizations: names
        )
        if activeOrg?.caseInsensitiveCompare(selection) != .orderedSame {
            accounts.setSelectedOrg(selection, for: login)
        }
        loadMembership()
        if let selected = activeOrg {
            await refreshConnectionStatus(login: login, org: selected)
        }
    }

    private func refreshConnectionStatus(login: String, org: String) async {
        if isDemoMode {
            orgConnectionsPerLogin[login] = [org.lowercased(): true]
            lastError = nil
            return
        }
        let client = APIClient(
            token: { [weak self] in self?.accounts.accessToken(for: login) },
            org: org,
            refresh: { [weak self] in
                guard self != nil else { return false }
                return await AuthService.shared.refreshIfPossible(login: login)
            }
        )
        do {
            let status = try await client.fetchNoxConnectStatus()
            guard accounts.activeLogin == login, activeOrg == org else { return }
            var states = orgConnectionsPerLogin[login] ?? [:]
            states[org.lowercased()] = status.github.connected
            orgConnectionsPerLogin[login] = states
            lastError = nil
            if status.github.connected {
                // Product analytics must never interfere with loading NoxHere.
                try? await client.recordAppActivity()
            }
        } catch {
            guard accounts.activeLogin == login, activeOrg == org else { return }
            lastError = "Couldn't check whether NoxConnect is installed on \(org)."
        }
    }

    /// Fetch /api/v1/me for the active account+org — carries the per-org admin
    /// flag.
    private func loadMembership() {
        membershipTask?.cancel()
        if isDemoMode {
            isAdmin = true
            return
        }
        guard let login = accounts.activeLogin, let org = activeOrg else {
            isAdmin = false
            return
        }
        membershipTask = Task { [weak self] in
            guard let self else { return }
            let client = self.makeAPIClient()
            if let me = try? await client.fetchNoxConnectMember() {
                guard !Task.isCancelled,
                      self.accounts.activeLogin == login,
                      self.activeOrg == org else { return }
                self.isAdmin = me.isAdmin
            } else {
                guard !Task.isCancelled,
                      self.accounts.activeLogin == login,
                      self.activeOrg == org else { return }
                self.isAdmin = false
            }
        }
    }
}
