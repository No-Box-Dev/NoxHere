import Foundation
#if os(macOS)
import AppKit
#else
import UIKit
#endif
import AuthenticationServices

/// Brokered GitHub Device Flow (RFC 8628) through NoxConnect.
/// The app receives only short-lived NoxConnect access credentials and a
/// rotating NoxConnect refresh credential. GitHub credentials remain
/// encrypted on the server and never enter a NoxHere app.
@MainActor
final class AuthService: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthService()

    private var accounts: AccountsStore?
    private var refreshTasks: [String: Task<Bool, Never>] = [:]
    private var webAuthenticationSession: ASWebAuthenticationSession?
    private var webAuthenticationSessionID: UUID?

    private override init() { super.init() }

    func bind(_ store: AccountsStore) { self.accounts = store }

    // MARK: - Device flow

    struct DeviceInit {
        let userCode: String
        let verificationUri: URL
        let deviceCode: String
        let interval: TimeInterval
        let expiresAt: Date
    }

    enum AuthError: Error, LocalizedError {
        case network(String)
        case cancelledByUser
        case expired
        case decode
        case unavailable

        var errorDescription: String? {
            switch self {
            case .network(let m): return m
            case .cancelledByUser: return "Sign-in cancelled."
            case .expired: return "Sign-in code expired. Try again."
            case .decode: return "Unexpected response from GitHub."
            case .unavailable: return "Authentication is not ready. Please try again."
            }
        }
    }

    /// Kick off device flow. Returns the user-facing code + verification URL.
    func startDeviceFlow() async throws -> DeviceInit {
        var req = URLRequest(url: Config.apiBase.appendingPathComponent("/api/v1/auth/native/device/start"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["client": "noxfeed-mac"])

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw AuthError.network("NoxConnect couldn't start GitHub sign-in.")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let deviceCode = json["device_code"] as? String,
              let userCode = json["user_code"] as? String,
              let verificationUri = json["verification_uri"] as? String,
              let verificationURL = URL(string: verificationUri),
              let interval = json["interval"] as? Int,
              let expiresIn = json["expires_in"] as? Int
        else {
            throw AuthError.decode
        }
        return DeviceInit(
            userCode: userCode,
            verificationUri: verificationURL,
            deviceCode: deviceCode,
            interval: TimeInterval(interval),
            expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn))
        )
    }

    /// Poll NoxConnect while it completes GitHub authorization server-side.
    /// Only NoxConnect credentials are stored in the Keychain.
    func pollForAccessToken(_ deviceInit: DeviceInit) async throws {
        guard let accounts else { throw AuthError.unavailable }
        var interval = deviceInit.interval
        while Date() < deviceInit.expiresAt {
            try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            var req = URLRequest(url: Config.apiBase.appendingPathComponent("/api/v1/auth/native/device/poll"))
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "client": "noxfeed-mac",
                "device_code": deviceInit.deviceCode,
            ])

            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw AuthError.decode }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw AuthError.decode
            }

            if http.statusCode == 200,
               let access = json["access_token"] as? String,
               let refresh = json["refresh_token"] as? String,
               let user = json["user"] as? [String: Any],
               let login = user["login"] as? String {
                let avatarUrl = user["avatar_url"] as? String
                try accounts.upsert(login: login, access: access, refresh: refresh, avatarUrl: avatarUrl)
                return
            }
            if let err = Self.errorCode(in: json) {
                switch err {
                case "authorization_pending":
                    continue
                case "slow_down":
                    if let retry = http.value(forHTTPHeaderField: "Retry-After"), let seconds = TimeInterval(retry) {
                        interval = max(interval, seconds)
                    } else {
                        interval += 5
                    }
                    continue
                case "access_denied":
                    throw AuthError.cancelledByUser
                case "expired_token":
                    throw AuthError.expired
                default:
                    let message = Self.errorMessage(in: json) ?? "NoxConnect sign-in failed."
                    throw AuthError.network(message)
                }
            }
            throw AuthError.network("NoxConnect returned an unexpected sign-in response.")
        }
        throw AuthError.expired
    }

    private static func errorCode(in json: [String: Any]) -> String? {
        if let code = json["error"] as? String { return code }
        return (json["error"] as? [String: Any])?["code"] as? String
    }

    private static func errorMessage(in json: [String: Any]) -> String? {
        if let message = json["error_description"] as? String { return message }
        return (json["error"] as? [String: Any])?["message"] as? String
    }

    // MARK: - Session migration and rotation

    /// Exchanges an existing GitHub credential once during upgrade. New
    /// releases never create or persist provider credentials themselves.
    func ensureNoxSession(login: String) async -> Bool {
        guard let accounts, let access = accounts.accessToken(for: login) else { return false }
        if access.hasPrefix("nox_at_") { return true }

        var body: [String: String] = ["client": "noxfeed-mac", "access_token": access]
        if let refresh = accounts.refreshToken(for: login) { body["refresh_token"] = refresh }
        var request = URLRequest(url: Config.apiBase.appendingPathComponent("/api/v1/auth/native/exchange"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let nextAccess = json["access_token"] as? String,
                  let nextRefresh = json["refresh_token"] as? String else { return false }
            try accounts.rotateTokens(login: login, access: nextAccess, refresh: nextRefresh)
            return true
        } catch {
            return false
        }
    }

    /// Coalesces concurrent refreshes for the SAME account so a burst of
    /// 401s produces one network call. Returns true if the account has a
    /// valid access token after this call.
    static func refreshResponseRequiresSignOut(_ statusCode: Int) -> Bool {
        // 410 is returned when a retired or revoked refresh contract can no
        // longer be used. Keeping that local account makes onboarding loop on
        // "load teams" forever, so treat it like the other terminal auth
        // responses. Server and connectivity failures remain retryable.
        [400, 401, 403, 410].contains(statusCode)
    }

    func refreshIfPossible(login: String) async -> Bool {
        guard accounts != nil else { return false }
        if let inFlight = refreshTasks[login] { return await inFlight.value }
        let task = Task<Bool, Never> { [weak self] in
            guard let self, let accounts = self.accounts else { return false }
            defer { self.refreshTasks[login] = nil }
            guard let refresh = accounts.refreshToken(for: login) else { return false }

            var req = URLRequest(url: Config.apiBase.appendingPathComponent("/api/v1/auth/native/refresh"))
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refresh])

            do {
                let (data, resp) = try await URLSession.shared.data(for: req)
                guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
                    if let http = resp as? HTTPURLResponse,
                       Self.refreshResponseRequiresSignOut(http.statusCode) {
                        accounts.signOut(login: login)
                    }
                    return false
                }
                guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let access = json["access_token"] as? String,
                      let newRefresh = json["refresh_token"] as? String
                else { return false }
                try accounts.rotateTokens(login: login, access: access, refresh: newRefresh)
                return true
            } catch {
                return false
            }
        }
        refreshTasks[login] = task
        return await task.value
    }

    /// Best-effort server revocation. Callers delete the local Keychain
    /// values immediately, so sign-out remains reliable while offline.
    func revokeSession(refreshToken: String) async {
        guard refreshToken.hasPrefix("nox_rt_") else { return }
        var request = URLRequest(url: Config.apiBase.appendingPathComponent("/api/v1/auth/native/revoke"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        _ = try? await URLSession.shared.data(for: request)
    }

    func beginWebAuthentication(at url: URL) throws {
        webAuthenticationSession?.cancel()
        webAuthenticationSession = nil
        let sessionID = UUID()
        webAuthenticationSessionID = sessionID
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: nil
        ) { [weak self] _, _ in
            guard self?.webAuthenticationSessionID == sessionID else { return }
            self?.webAuthenticationSession = nil
            self?.webAuthenticationSessionID = nil
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        guard session.start() else { throw AuthError.unavailable }
        webAuthenticationSession = session
    }

    func endWebAuthentication() {
        webAuthenticationSession?.cancel()
        webAuthenticationSession = nil
        webAuthenticationSessionID = nil
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
#if os(macOS)
        NSApplication.shared.keyWindow
            ?? NSApplication.shared.windows.first
            ?? ASPresentationAnchor()
#else
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow)
            ?? scenes.flatMap(\.windows).first
            ?? ASPresentationAnchor()
#endif
    }
}
