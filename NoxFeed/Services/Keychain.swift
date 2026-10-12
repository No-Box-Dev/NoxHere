import Foundation
import LocalAuthentication
import Security

/// Minimal Keychain wrapper backed by the app's data-protection access group.
enum Keychain {
    private static let service = "dev.noboxdev.noxfeed"

    static func set(_ value: String, account: String) throws {
        let data = Data(value.utf8)
        let query = query(account: account)
        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainError.osStatus(updateStatus)
        }

        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.osStatus(status) }
    }

    static func get(account: String) -> String? {
        if let value = read(query: query(account: account, returnData: true)) {
            return value
        }

        // Earlier releases used the legacy file-based macOS Keychain.
        // A development-signed item there can show a password prompt when an
        // App Store-signed build reads it. Suppress all UI: migrate items the
        // current signature may read silently, otherwise treat them as absent.
        let legacyQuery = query(
            account: account,
            returnData: true,
            dataProtection: false,
            suppressInteraction: true
        )
        guard let legacyValue = read(query: legacyQuery) else { return nil }

        do {
            try set(legacyValue, account: account)
            deleteLegacy(account: account)
        } catch {
            // The usable legacy value remains valid for this process. A later
            // launch can retry migration without ever asking for a password.
        }
        return legacyValue
    }

    private static func read(query: [String: Any]) -> String? {
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data, let s = String(data: data, encoding: .utf8) else {
            return nil
        }
        return s
    }

    static func delete(account: String) {
        SecItemDelete(query(account: account) as CFDictionary)
        deleteLegacy(account: account)
    }

    private static func deleteLegacy(account: String) {
        let legacyQuery = query(
            account: account,
            dataProtection: false,
            suppressInteraction: true
        )
        SecItemDelete(legacyQuery as CFDictionary)
    }

    /// Exposed internally so tests can lock down the security domain used by
    /// every Keychain operation without reading or writing a real credential.
    static func query(
        account: String,
        returnData: Bool = false,
        dataProtection: Bool = true,
        suppressInteraction: Bool = false
    ) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if dataProtection {
            query[kSecUseDataProtectionKeychain as String] = true
        }
        if returnData {
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
        }
        if suppressInteraction {
            let context = LAContext()
            context.interactionNotAllowed = true
            query[kSecUseAuthenticationContext as String] = context
        }
        return query
    }

    enum KeychainError: Error { case osStatus(OSStatus) }
}
