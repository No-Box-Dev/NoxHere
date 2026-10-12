import Foundation

/// Enough to identify + navigate a PR across both destinations
/// (planning's `/prs/{repo}/{n}` and GitHub's `{org}/{repo}/pull/{n}`).
/// Title is optional — carried through for the header label when we have
/// it, empty when we don't.
struct PRRef: Identifiable, Hashable {
    let org: String
    let repo: String
    let number: Int
    let title: String?

    var id: String { "\(org)/\(repo)#\(number)" }

    var githubURL: URL? {
        URL(string: "https://github.com/\(org)/\(repo)/pull/\(number)")
    }
}
