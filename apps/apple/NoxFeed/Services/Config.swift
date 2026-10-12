import Foundation

enum Config {
    static let apiBase = URL(string: "https://app.noxhere.com")!
    static let demoAPIBase = URL(string: "https://noxfeed-response.jasper-414.workers.dev")!

    // Install URL for the NoxConnect GitHub App — surfaced when an org
    // has no data because the App isn't installed there yet. The user picks
    // which org/repos to connect in GitHub's install flow.
    static let githubAppInstallURL = URL(string: "https://github.com/apps/noxconnect/installations/new")!

    // GitHub's organization settings page lets a user accept a pending
    // invitation or create a new organization from one clear starting point.
    static let githubOrganizationsURL = URL(string: "https://github.com/settings/organizations")!

    /// Opens the selected organisation's AI provider card in NoxConnect.
    static func aiProviderSettingsURL(org: String) -> URL {
        var components = URLComponents(url: apiBase, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "org", value: org),
            URLQueryItem(name: "tab", value: "settings"),
            URLQueryItem(name: "focus", value: "aiProvider"),
        ]
        return components.url!
    }
}
