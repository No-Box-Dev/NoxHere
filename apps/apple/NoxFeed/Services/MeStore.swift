import Foundation

/// Fetches open PRs, assigned issues, and owned NoxTicket features for a
/// specific GitHub login (not necessarily the signed-in user — used by the
/// Current tab to view anyone in the org). Refetches when the login changes.
///
/// Two-phase like the feed + timeline: the per-login lists render immediately
/// (fast `fetchMyPRs` / `fetchMyIssues`) and the org-wide activity scan that
/// supplies per-PR badges runs in the background. The first page is
/// stale-while-revalidate cached in TimelineCache, so revisiting a person is
/// instant.
@MainActor
final class MeStore: ObservableObject {
    @Published var prs: [PullRequest] = []
    @Published var issues: [Issue] = []
    @Published var features: [NoxTicketFeature] = []
    @Published var noxTicketEnabled = false
    @Published private(set) var latestPREvents: [String: FeedEvent] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var currentLogin: String?

    private var clientProvider: (() -> APIClient?)?
    private var cache: TimelineCache?
    private var pollTask: Task<Void, Never>?
    private var requestGeneration = 0

    func attach(clientProvider: @escaping () -> APIClient?, cache: TimelineCache) {
        self.clientProvider = clientProvider
        self.cache = cache
    }

    /// Load data for the given login. SWR-primes from cache and refetches when
    /// stale. The owning view controls polling so hidden menu content never
    /// keeps making network requests.
    func setLogin(_ login: String?) async {
        requestGeneration += 1
        currentLogin = login
        errorMessage = nil
        if let login, let entry = cache?.myItems(login) {
            prs = entry.prs
            issues = entry.issues
            features = entry.features
            noxTicketEnabled = entry.noxTicketEnabled
            latestPREvents = entry.latestPREvents
            if entry.age < TimelineCache.refreshTTL {
                return
            }
        } else {
            prs = []
            issues = []
            features = []
            noxTicketEnabled = false
            latestPREvents = [:]
        }
        await refresh()
    }

    func refresh() async {
        guard let client = clientProvider?(), let login = currentLogin, !login.isEmpty else {
            prs = []
            issues = []
            features = []
            noxTicketEnabled = false
            return
        }
        requestGeneration += 1
        let generation = requestGeneration
        let cold = prs.isEmpty && issues.isEmpty
        if cold { isLoading = true }
        errorMessage = nil
        defer {
            if cold && generation == requestGeneration { isLoading = false }
        }
        do {
            // Phase 1 (fast): the per-login lists. Render immediately.
            async let prsResult = try client.fetchMyPRs(login: login)
            async let issuesResult = try client.fetchMyIssues(login: login)
            async let featuresResult = try client.fetchOpenNoxTicketFeaturesIfEnabled()
            let (fetchedPRs, fetchedIssues) = try await (prsResult, issuesResult)
            guard generation == requestGeneration, currentLogin == login else { return }

            // Boundary filter: /api/v1/prs?author=login should only return PRs
            // authored by login, but a reconcile/webhook race can momentarily
            // return someone else's PR (seen in the wild). Drop any row whose
            // author is known and doesn't match; keep nil-author rows so
            // partially-synced records still render.
            let mine = Self.currentPullRequests(from: fetchedPRs, login: login)
            self.prs = mine
            self.issues = fetchedIssues
            do {
                let fetchedFeatures = try await featuresResult
                guard generation == requestGeneration, currentLogin == login else { return }
                self.features = fetchedFeatures ?? []
                self.noxTicketEnabled = fetchedFeatures != nil
            } catch {
                // Features are supplementary. A temporary NoxTicket failure
                // must not take PRs and issues off the Current page.
            }
            cacheCurrentItems(login: login, prs: mine, issues: fetchedIssues)

            // Phase 2 (background): per-PR activity badges from the org-wide
            // recent feed (shared + cached). This paged scan is the slow part;
            // it runs after the lists are on screen, not before.
            let cutoff = Calendar.current.date(byAdding: .day, value: -3, to: Date()) ?? Date().addingTimeInterval(-3 * 86_400)
            let recent = await FeedData.recent(since: cutoff, client: client, cache: cache)
            guard !Task.isCancelled,
                  generation == requestGeneration,
                  currentLogin == login else { return }
            let activity = Self.indexLatestPRActivity(recent, prs: mine)
            self.latestPREvents = activity
            cacheCurrentItems(login: login, prs: mine, issues: fetchedIssues)
        } catch APIError.unauthorized {
            guard generation == requestGeneration, currentLogin == login else { return }
            if prs.isEmpty && issues.isEmpty { errorMessage = "Session expired. Sign in again from the menu." }
        } catch {
            guard generation == requestGeneration, currentLogin == login else { return }
            if prs.isEmpty && issues.isEmpty { errorMessage = error.userFacingDescription }
        }
    }

    private func cacheCurrentItems(login: String, prs: [PullRequest], issues: [Issue]) {
        cache?.setMyItems(
            login, prs: prs, issues: issues, features: features,
            noxTicketEnabled: noxTicketEnabled, latestPREvents: latestPREvents
        )
    }

    func startPolling() {
        stopPolling()
        let boundLogin = currentLogin
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                if Task.isCancelled { return }
                // Don't poll if the login has changed under us.
                if self?.currentLogin != boundLogin { return }
                await self?.refresh()
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func latestActivity(for pr: PullRequest) -> PRActivity {
        let event = Self.key(repo: pr.repo, number: pr.number).flatMap { latestPREvents[$0] }
        return PRActivity.latest(for: pr, event: event)
    }

    static func currentPullRequests(from pullRequests: [PullRequest], login: String) -> [PullRequest] {
        pullRequests.filter { pr in
            guard pr.isOpen else { return false }
            guard let author = pr.author?.lowercased(), !author.isEmpty else { return true }
            return author == login.lowercased()
        }
    }

    private static func indexLatestPRActivity(_ events: [FeedEvent], prs: [PullRequest]) -> [String: FeedEvent] {
        var result: [String: FeedEvent] = [:]
        var prsByBranch: [String: [PullRequest]] = [:]
        for pr in prs {
            guard let repo = pr.repo?.lowercased(), let branch = pr.headRef else { continue }
            prsByBranch["\(repo)|\(branch)", default: []].append(pr)
        }
        for event in events.sorted(by: { $0.createdAt > $1.createdAt }) where PRActivity.isMeaningful(event) {
            if event.type == "github:push",
               let repo = event.repo?.lowercased(),
               let branch = branchName(event.payload?.pushRef) {
                for pr in prsByBranch["\(repo)|\(branch)"] ?? [] {
                    guard let prKey = key(repo: pr.repo, number: pr.number), result[prKey] == nil else { continue }
                    result[prKey] = event
                }
                continue
            }
            guard let key = key(repo: event.repo, number: event.payload?.prNumber), result[key] == nil else {
                continue
            }
            result[key] = event
        }
        return result
    }

    private static func key(repo: String?, number: Int?) -> String? {
        guard let repo, !repo.isEmpty, let number else { return nil }
        return "\(repo.lowercased())#\(number)"
    }

    private static func branchName(_ ref: String?) -> String? {
        guard let ref, !ref.isEmpty else { return nil }
        return ref.hasPrefix("refs/heads/") ? String(ref.dropFirst("refs/heads/".count)) : ref
    }
}
