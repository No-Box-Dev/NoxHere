import Foundation

enum GitHubWorkspaceKind: String, Hashable {
    case personal
    case organization
}

struct GitHubWorkspace: Identifiable, Hashable {
    let login: String
    let kind: GitHubWorkspaceKind

    var id: String { "\(kind.rawValue):\(login.lowercased())" }

    var displayName: String {
        switch kind {
        case .personal: "Personal · @\(login)"
        case .organization: login
        }
    }
}

enum GitHubWorkspaceSelection {
    static func workspaces(login: String, organizations: [String]) -> [GitHubWorkspace] {
        let personal = GitHubWorkspace(login: login, kind: .personal)
        let organizations = organizations
            .filter { $0.caseInsensitiveCompare(login) != .orderedSame }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            .map { GitHubWorkspace(login: $0, kind: .organization) }
        return [personal] + organizations
    }

    static func resolvedSelection(
        current: String?,
        login: String,
        organizations: [String]
    ) -> String {
        let available = workspaces(login: login, organizations: organizations)
        if let current,
           available.contains(where: { $0.login.caseInsensitiveCompare(current) == .orderedSame }) {
            return current
        }
        // Preserve the existing organization-first default for established
        // users, while personal becomes the useful fallback for users who do
        // not belong to a GitHub organization.
        return available.first(where: { $0.kind == .organization })?.login ?? login
    }
}
