import Foundation
import Combine

/// One signed-in GitHub identity, along with the personal or organization workspace it last viewed.
/// Tokens live in the Keychain keyed by login; everything else lives in
/// UserDefaults.
struct Account: Identifiable, Hashable, Codable {
    let login: String
    var avatarUrl: String?
    var selectedOrg: String?

    var id: String { login }
}

/// Manages multiple signed-in GitHub accounts. Keychain layout:
///   gh_access:<login>   → access token
///   gh_refresh:<login>  → refresh token
///
/// UserDefaults layout:
///   unticket-feed.accountsList  → JSON [Account]  (all known accounts)
///   unticket-feed.activeLogin   → String          (which one is active)
///
/// Legacy single-account keys (`gh_access_token` / `gh_refresh_token`) are
/// migrated into the new layout on first launch of this version.
@MainActor
final class AccountsStore: ObservableObject {
    enum StoreError: Error, LocalizedError {
        case keychainWriteFailed

        var errorDescription: String? {
            switch self {
            case .keychainWriteFailed:
#if os(macOS)
                return "GitHub approved the sign-in, but NoxHere couldn't save it securely in your Mac Keychain. Please reopen NoxHere and try again."
#else
                return "GitHub approved the sign-in, but NoxHere couldn't save it securely in your Keychain. Please reopen NoxHere and try again."
#endif
            }
        }
    }
    @Published private(set) var accounts: [Account] = []
    @Published private(set) var activeLogin: String?

    private static let listKey = "unticket-feed.accountsList"
    private static let activeKey = "unticket-feed.activeLogin"

    init() {
        migrateLegacyIfNeeded()
        load()
    }

    // MARK: - Reads

    var activeAccount: Account? {
        guard let activeLogin else { return nil }
        return accounts.first { $0.login == activeLogin }
    }

    var isEmpty: Bool { accounts.isEmpty }

    func accessToken(for login: String) -> String? {
        Keychain.get(account: Self.accessAccount(login))
    }

    func refreshToken(for login: String) -> String? {
        Keychain.get(account: Self.refreshAccount(login))
    }

    // MARK: - Writes

    /// Add or update an account after a successful sign-in. Sets it as
    /// active and returns the resulting Account. Safe to call for both
    /// first-account and add-another-account flows.
    @discardableResult
    func upsert(login: String, access: String, refresh: String?, avatarUrl: String?) throws -> Account {
        guard writeTokens(login: login, access: access, refresh: refresh) else {
            throw StoreError.keychainWriteFailed
        }
        var acct: Account
        if let idx = accounts.firstIndex(where: { $0.login == login }) {
            acct = accounts[idx]
            if let avatarUrl { acct.avatarUrl = avatarUrl }
            accounts[idx] = acct
        } else {
            acct = Account(login: login, avatarUrl: avatarUrl, selectedOrg: nil)
            accounts.append(acct)
        }
        setActive(login: login)
        persistList()
        return acct
    }

    /// Rotate tokens for an existing account (called by the refresh flow).
    func rotateTokens(login: String, access: String, refresh: String?) throws {
        guard writeTokens(login: login, access: access, refresh: refresh) else {
            throw StoreError.keychainWriteFailed
        }
    }

    func setActive(login: String?) {
        activeLogin = login
        if let login {
            UserDefaults.standard.set(login, forKey: Self.activeKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.activeKey)
        }
    }

    func setSelectedOrg(_ org: String?, for login: String) {
        guard let idx = accounts.firstIndex(where: { $0.login == login }) else { return }
        accounts[idx].selectedOrg = org
        persistList()
    }

    /// Remove an account entirely: purge tokens, drop from the list. If it
    /// was active, promote the next account or fall back to signed-out.
    func signOut(login: String) {
        Keychain.delete(account: Self.accessAccount(login))
        Keychain.delete(account: Self.refreshAccount(login))
        accounts.removeAll { $0.login == login }
        persistList()
        if activeLogin == login {
            setActive(login: accounts.first?.login)
        }
    }

    // MARK: - Internals

    @discardableResult
    private func writeTokens(login: String, access: String, refresh: String?) -> Bool {
        do {
            try Keychain.set(access, account: Self.accessAccount(login))
            if let refresh {
                try Keychain.set(refresh, account: Self.refreshAccount(login))
            }
            return true
        } catch {
            // Surface this through the caller's normal error UI. A failed
            // credential write must never terminate the app, including in a
            // development build with missing or incorrect entitlements.
            NSLog("NoxHere Keychain write failed for %@: %@", login, String(describing: error))
            return false
        }
    }

    private func load() {
        if let data = UserDefaults.standard.data(forKey: Self.listKey),
           let list = try? JSONDecoder().decode([Account].self, from: data) {
            self.accounts = list
        }
        if let active = UserDefaults.standard.string(forKey: Self.activeKey),
           accounts.contains(where: { $0.login == active }) {
            self.activeLogin = active
        } else {
            self.activeLogin = accounts.first?.login
            if activeLogin != nil {
                UserDefaults.standard.set(activeLogin, forKey: Self.activeKey)
            }
        }
    }

    private func persistList() {
        if let data = try? JSONEncoder().encode(accounts) {
            UserDefaults.standard.set(data, forKey: Self.listKey)
        }
    }

    /// One-shot migration: the previous single-account layout stored tokens
    /// under fixed Keychain accounts `gh_access_token` / `gh_refresh_token`.
    /// If those exist but the new accountsList is empty, salvage them under
    /// a temporary placeholder login; the first API call rewrites them under
    /// the real login. This keeps the user signed in across the upgrade.
    private func migrateLegacyIfNeeded() {
        let hasNewList = UserDefaults.standard.data(forKey: Self.listKey) != nil
        if hasNewList { return }
        guard let legacyAccess = Keychain.get(account: "gh_access_token") else { return }
        let legacyRefresh = Keychain.get(account: "gh_refresh_token")

        let placeholder = "__pending__"
        do {
            try Keychain.set(legacyAccess, account: Self.accessAccount(placeholder))
            if let legacyRefresh {
                try Keychain.set(legacyRefresh, account: Self.refreshAccount(placeholder))
            }
        } catch {
            // Preserve the originals so a later launch can safely retry.
            return
        }
        guard Keychain.get(account: Self.accessAccount(placeholder)) == legacyAccess,
              legacyRefresh == nil || Keychain.get(account: Self.refreshAccount(placeholder)) == legacyRefresh
        else { return }

        let acct = Account(login: placeholder, avatarUrl: nil, selectedOrg: nil)
        if let data = try? JSONEncoder().encode([acct]) {
            UserDefaults.standard.set(data, forKey: Self.listKey)
        }
        UserDefaults.standard.set(placeholder, forKey: Self.activeKey)

        Keychain.delete(account: "gh_access_token")
        if legacyRefresh != nil { Keychain.delete(account: "gh_refresh_token") }
    }

    /// After sign-in / first API call we know the real login for the
    /// migrated placeholder — rename the Keychain items + account entry.
    func promotePlaceholderIfNeeded(realLogin: String, avatarUrl: String?) {
        let placeholder = "__pending__"
        guard accounts.contains(where: { $0.login == placeholder }) else { return }
        let access = Keychain.get(account: Self.accessAccount(placeholder))
        let refresh = Keychain.get(account: Self.refreshAccount(placeholder))
        guard let access,
              writeTokens(login: realLogin, access: access, refresh: refresh),
              Keychain.get(account: Self.accessAccount(realLogin)) == access
        else { return }

        var replacement = Account(login: realLogin, avatarUrl: avatarUrl, selectedOrg: nil)
        if let existing = accounts.first(where: { $0.login == realLogin }) {
            replacement.selectedOrg = existing.selectedOrg
            if replacement.avatarUrl == nil { replacement.avatarUrl = existing.avatarUrl }
        }
        accounts.removeAll { $0.login == placeholder || $0.login == realLogin }
        accounts.append(replacement)
        persistList()
        setActive(login: realLogin)
        Keychain.delete(account: Self.accessAccount(placeholder))
        if refresh != nil { Keychain.delete(account: Self.refreshAccount(placeholder)) }
    }

    private static func accessAccount(_ login: String) -> String { "gh_access:\(login)" }
    private static func refreshAccount(_ login: String) -> String { "gh_refresh:\(login)" }
}
