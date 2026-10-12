import Foundation

/// Owns the current (account, org) feed. Server does the filtering (actor_id
/// + project_id); this store just fetches, paginates, and polls. Native
/// notifications are NotifierStore's job — it runs app-wide, independent of
/// which feed tab is visible. One instance per FeedView lifetime; the view
/// rebinds it when the active account/org changes.
///
/// The first page is stale-while-revalidate cached in TimelineCache
/// (app-lifetime, shared across FeedView recreations): opening the feed or
/// returning from a PR renders the last list instantly and refreshes in the
/// background.
@MainActor
final class FeedStore: ObservableObject {
    @Published var events: [FeedEvent] = []
    @Published var mode: FeedMode = .posts
    @Published var actorId: String = ""
    @Published var projectId: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var canLoadMore = false
    @Published private(set) var isRefreshing = false

    private struct FirstPageRequest {
        let id: UUID
        let task: Task<FeedPage, Error>
    }

    private var clientProvider: (() -> APIClient?)?
    private var cache: TimelineCache?
    private var pollTask: Task<Void, Never>?
    private var nextCursor: String?
    private var requestGeneration = 0
    private var firstPageRequests: [String: FirstPageRequest] = [:]
    /// The (mode + filters) key the currently-displayed events belong to, so a
    /// mode/filter switch is detected as "different list" even though `events`
    /// is non-empty.
    private var displayedKey: String?
    private let pageSize = 25
    private static let pollInterval: UInt64 = 10
    private static let maximumPollInterval: UInt64 = 60

    func attach(clientProvider: @escaping () -> APIClient?, cache: TimelineCache) async {
        self.clientProvider = clientProvider
        self.cache = cache
        await refresh()
    }

    /// Called when the active login/org changes — the cached and displayed
    /// events belong to the old scope, so drop them and re-prime on next load.
    func scopeChanged() {
        requestGeneration += 1
        displayedKey = nil
        events = []
        nextCursor = nil
    }

    // MARK: - Fetching

    /// User-initiated refreshes get visible feedback and always wait for a
    /// server response. If polling already started the same request, reuse it
    /// instead of dropping the button click or issuing duplicate traffic.
    func refreshNow() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        await refresh()
    }

    func refresh() async {
        // Current mode has no feed events; the view swaps in MyItemsView which
        // owns its own store. Bail early so we don't fire useless calls.
        if mode == .current || mode == .issues {
            requestGeneration += 1
            isLoading = false
            events = []
            errorMessage = nil
            displayedKey = nil
            return
        }
        guard let client = clientProvider?() else { return }

        let key = feedKey
        let requestedMode = mode
        let requestedFilters = filters
        let keyChanged = key != displayedKey
        displayedKey = key

        // Stale-while-revalidate for a new key: render the cached first page
        // instantly, or clear so the spinner shows if nothing is cached.
        // FeedView only shows the spinner when `events` is empty, so priming
        // from cache keeps the previous list on screen during the refresh.
        if keyChanged {
            if let entry = cache?.feedPage(key) {
                events = entry.events
                nextCursor = entry.nextCursor
                canLoadMore = entry.events.count == pageSize && entry.nextCursor != nil
            } else {
                events = []
                nextCursor = nil
            }
        }

        requestGeneration += 1
        let generation = requestGeneration

        let cold = events.isEmpty
        if cold { isLoading = true }
        errorMessage = nil
        defer {
            if cold && generation == requestGeneration { isLoading = false }
        }
        do {
            let page = try await firstPage(
                client: client,
                key: key,
                mode: requestedMode,
                filters: requestedFilters
            )
            guard generation == requestGeneration, key == feedKey else { return }
            self.events = page.events
            self.nextCursor = page.nextCursor
            self.canLoadMore = page.events.count == pageSize && page.nextCursor != nil
            cache?.setFeedPage(key, events: page.events, nextCursor: page.nextCursor)
        } catch APIError.unauthorized {
            guard generation == requestGeneration, key == feedKey else { return }
            if events.isEmpty { errorMessage = "Session expired. Sign in again from the menu." }
        } catch {
            guard generation == requestGeneration, key == feedKey else { return }
            if events.isEmpty { errorMessage = error.userFacingDescription }
        }
    }

    func loadMore(limit: Int? = nil) async {
        guard let client = clientProvider?(), let cursor = nextCursor else { return }
        requestGeneration += 1
        let generation = requestGeneration
        let key = feedKey
        let requestedMode = mode
        let requestedFilters = filters
        let requestedLimit = limit ?? pageSize
        isLoading = true
        errorMessage = nil
        defer { if generation == requestGeneration { isLoading = false } }
        do {
            let page = try await client.fetchFeed(
                mode: requestedMode,
                filters: requestedFilters,
                limit: requestedLimit,
                before: cursor
            )
            guard generation == requestGeneration, key == feedKey else { return }
            let existingIds = Set(events.map(\.id))
            self.events.append(contentsOf: page.events.filter { !existingIds.contains($0.id) })
            let hasMore = page.events.count == requestedLimit && page.nextCursor != nil
            self.nextCursor = hasMore ? page.nextCursor : nil
            self.canLoadMore = hasMore
        } catch {
            guard generation == requestGeneration, key == feedKey else { return }
            errorMessage = error.userFacingDescription
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollTask = Task { [weak self] in
            var consecutiveFailures: UInt64 = 0
            while !Task.isCancelled {
                let multiplier = UInt64(1) << min(consecutiveFailures, 3)
                let delay = min(Self.pollInterval * multiplier, Self.maximumPollInterval)
                do { try await Task.sleep(nanoseconds: delay * 1_000_000_000) }
                catch { return }
                guard !Task.isCancelled, let self else { return }
                consecutiveFailures = await self.pollOnce() ? 0 : min(consecutiveFailures + 1, 3)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    @discardableResult
    func pollOnce() async -> Bool {
        if mode == .current || mode == .issues { return true }
        guard let client = clientProvider?() else { return false }
        let generation = requestGeneration
        let key = feedKey
        let requestedMode = mode
        let requestedFilters = filters
        do {
            let page = try await firstPage(
                client: client,
                key: key,
                mode: requestedMode,
                filters: requestedFilters
            )
            guard generation == requestGeneration, key == feedKey else { return true }
            let pageIds = Set(page.events.map(\.id))
            let merged = page.events + events.filter { !pageIds.contains($0.id) }
            if merged != events { events = merged }
            // Keep the cached first page current so a later SWR render shows
            // recent data.
            cache?.setFeedPage(key, events: page.events, nextCursor: page.nextCursor)
            return true
        } catch {
            // Polling failures stay silent.
            return false
        }
    }

    private func firstPage(
        client: APIClient,
        key: String,
        mode: FeedMode,
        filters: APIClient.FeedFilters
    ) async throws -> FeedPage {
        if let request = firstPageRequests[key] {
            return try await request.task.value
        }

        let id = UUID()
        let task = Task {
            try await client.fetchFeed(mode: mode, filters: filters, limit: pageSize)
        }
        firstPageRequests[key] = FirstPageRequest(id: id, task: task)
        defer {
            if firstPageRequests[key]?.id == id { firstPageRequests[key] = nil }
        }
        return try await task.value
    }

    // MARK: - Filter changes

    func applyFilters() async {
        nextCursor = nil
        await refresh()
    }

    private var filters: APIClient.FeedFilters {
        APIClient.FeedFilters(actorId: actorId.isEmpty ? nil : actorId,
                              projectId: projectId.isEmpty ? nil : projectId)
    }

    /// Stable key for the (mode + actor + project) combination shown right now.
    private var feedKey: String { "\(mode.rawValue)/\(actorId)/\(projectId)" }
}
