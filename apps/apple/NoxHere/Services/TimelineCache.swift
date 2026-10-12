import Foundation

/// App-lifetime cache for feed-surface data, all served stale-while-revalidate
/// (render cached rows instantly, refresh in the background once stale):
///
/// 1. The feed LIST first page (FeedStore) — opening the popover or returning
///    from a PR re-renders the last list instantly instead of refetching from
///    empty, because FeedView/FeedStore are recreated on each navigation.
/// 2. The Current tab per-person PRs + issues + Planning features (MeStore).
/// 3. Built timeline groups per PR (TimelineStore) — re-opening a PR is instant.
/// 4. The two org-wide sub-fetches (`fetchActors()` + the paged
///    `fetchRecentEvents(since:)`), shared across all of the above.
///
/// This cache sits above the FeedView/TimelineView/CurrentView lifetimes. All
/// entries are scoped to the active login/org; `invalidate()` clears everything
/// and is called on account/org switch (from FeedView's refresh).
@MainActor
final class TimelineCache: ObservableObject {
    private struct TimelineEntry { let groups: [TimelineStore.TimelineGroup]; let fetchedAt: Date }
    private struct ActorsEntry { let actors: [FeedActor]; let fetchedAt: Date }
    private struct RecentEntry { let events: [FeedEvent]; let fetchedAt: Date }
    private struct FeedPageEntry { let events: [FeedEvent]; let nextCursor: String?; let fetchedAt: Date }
    private struct MeEntry {
        let prs: [PullRequest]
        let issues: [Issue]
        let features: [PlanningFeature]
        let planningEnabled: Bool
        let latestPREvents: [String: FeedEvent]
        let fetchedAt: Date
    }

    private var timelines: [String: TimelineEntry] = [:]
    private var actors: ActorsEntry?
    private var recent: RecentEntry?
    private var feedPages: [String: FeedPageEntry] = [:]
    private var meItems: [String: MeEntry] = [:]

    /// Max age (seconds) before a cached entry is refreshed in the background.
    /// Re-opening within this window does no work at all.
    static let refreshTTL: TimeInterval = 30
    static let actorsTTL: TimeInterval = 300
    static let recentTTL: TimeInterval = 60

    /// Clear every entry. Call when the active login or org changes.
    func invalidate() {
        timelines.removeAll()
        feedPages.removeAll()
        meItems.removeAll()
        actors = nil
        recent = nil
    }

    // MARK: - Feed list (FeedStore)

    /// Cached first page for a (mode + filters) key, plus its age — the store
    /// renders it instantly and background-refreshes when stale.
    func feedPage(_ key: String) -> (events: [FeedEvent], nextCursor: String?, age: TimeInterval)? {
        guard let entry = feedPages[key] else { return nil }
        return (entry.events, entry.nextCursor, Date().timeIntervalSince(entry.fetchedAt))
    }

    func setFeedPage(_ key: String, events: [FeedEvent], nextCursor: String?) {
        feedPages[key] = FeedPageEntry(events: events, nextCursor: nextCursor, fetchedAt: Date())
    }

    // MARK: - Current tab (MeStore)

    /// Cached PRs + issues + features + per-PR activity for a login, plus its
    /// age — the store renders them instantly and decides whether to refresh.
    func myItems(_ login: String) -> (
        prs: [PullRequest], issues: [Issue], features: [PlanningFeature],
        planningEnabled: Bool, latestPREvents: [String: FeedEvent], age: TimeInterval
    )? {
        guard let entry = meItems[login] else { return nil }
        return (
            entry.prs, entry.issues, entry.features, entry.planningEnabled,
            entry.latestPREvents, Date().timeIntervalSince(entry.fetchedAt)
        )
    }

    func setMyItems(
        _ login: String, prs: [PullRequest], issues: [Issue],
        features: [PlanningFeature], planningEnabled: Bool,
        latestPREvents: [String: FeedEvent]
    ) {
        meItems[login] = MeEntry(
            prs: prs, issues: issues, features: features,
            planningEnabled: planningEnabled,
            latestPREvents: latestPREvents, fetchedAt: Date()
        )
    }

    // MARK: - PR timeline (TimelineStore)

    /// Cached groups plus their age, regardless of freshness — the store
    /// renders them instantly and decides whether to background-refresh.
    func timeline(repo: String, number: Int) -> (groups: [TimelineStore.TimelineGroup], age: TimeInterval)? {
        guard let entry = timelines[key(repo: repo, number: number)] else { return nil }
        return (entry.groups, Date().timeIntervalSince(entry.fetchedAt))
    }

    func setTimeline(repo: String, number: Int, groups: [TimelineStore.TimelineGroup]) {
        timelines[key(repo: repo, number: number)] = TimelineEntry(groups: groups, fetchedAt: Date())
    }

    // MARK: - Shared org-wide sub-fetches

    func cachedActors() -> [FeedActor]? {
        guard let entry = actors, Date().timeIntervalSince(entry.fetchedAt) < Self.actorsTTL else { return nil }
        return entry.actors
    }

    func setActors(_ value: [FeedActor]) {
        actors = ActorsEntry(actors: value, fetchedAt: Date())
    }

    func cachedRecent() -> [FeedEvent]? {
        guard let entry = recent, Date().timeIntervalSince(entry.fetchedAt) < Self.recentTTL else { return nil }
        return entry.events
    }

    func setRecent(_ value: [FeedEvent]) {
        recent = RecentEntry(events: value, fetchedAt: Date())
    }

    private func key(repo: String, number: Int) -> String { "\(repo.lowercased())#\(number)" }
}
