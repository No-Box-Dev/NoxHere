import Foundation

/// Shared cache-or-fetch shims for the two org-wide sub-fetches used across
/// every feed surface (feed list, PR timeline, Current tab). Both read the
/// shared TimelineCache first and only hit the network on a miss, so the paged
/// `fetchRecentEvents` scan and the actor list run at most once per TTL across
/// the whole app instead of once per view.
enum FeedData {
    @MainActor
    static func actors(client: APIClient, cache: TimelineCache?) async -> [FeedActor] {
        if let cache, let cached = cache.cachedActors() { return cached }
        let fetched = (try? await client.fetchActors()) ?? []
        cache?.setActors(fetched)
        return fetched
    }

    @MainActor
    static func recent(since cutoff: Date, client: APIClient, cache: TimelineCache?) async -> [FeedEvent] {
        if let cache, let cached = cache.cachedRecent() { return cached }
        let fetched = (try? await client.fetchRecentEvents(since: cutoff)) ?? []
        cache?.setRecent(fetched)
        return fetched
    }
}
