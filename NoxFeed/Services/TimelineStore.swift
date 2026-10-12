import Foundation

/// Fetches the last three days of meaningful status changes for one PR.
/// Narrative content is intentionally excluded from this store.
@MainActor
final class TimelineStore: ObservableObject {
    @Published var groups: [TimelineGroup] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// One compact status row in the timeline.
    struct TimelineGroup: Identifiable, Hashable {
        let id: String
        let kind: Kind
        let createdAt: Date
        let actorLogin: String?
        let actorAvatarUrl: String?
        let isBot: Bool

        enum Kind: Hashable {
            case opened(isDraft: Bool)
            case merged
            case closed         // github:pr:closed without merge
            case reopened       // github:pr:reopened
            case changesMade    // new commits pushed after feedback
            case reviewed(ReviewOutcome)
        }

        enum ReviewOutcome: String, Hashable {
            case approved
            case changesRequested
            case commented

            var label: String {
                switch self {
                case .approved: return "Approved"
                case .changesRequested: return "Requested changes"
                case .commented: return "Commented"
                }
            }
        }
    }

    func load(repo: String, prNumber: Int, client: APIClient, cache: TimelineCache) async {
        // Stale-while-revalidate: if we have any cached groups, render them
        // instantly and only refresh in the background once they're stale.
        // TimelineView is recreated on every open, so this makes revisits
        // instant instead of re-running the fetch.
        if let entry = cache.timeline(repo: repo, number: prNumber) {
            groups = entry.groups
            errorMessage = nil
            guard entry.age >= TimelineCache.refreshTTL else { return }
            await refresh(repo: repo, prNumber: prNumber, client: client, cache: cache, showLoading: false)
            return
        }

        // Cold open: render the fast core timeline ASAP, then augment with
        // push/changes-made rows in the background (see `refresh`).
        await refresh(repo: repo, prNumber: prNumber, client: client, cache: cache, showLoading: true)
    }

    /// Two-phase fetch so the view is never blocked on the heavy scan:
    ///   1. Foreground — the cheap PR-scoped `fetchEventsForPR`. Render these
    ///      immediately (opened/merged/closed/reviewed rows).
    ///   2. Background — the paged org-wide `fetchRecentEvents`, used only to
    ///      join in push/changes-made rows by head_ref. Publish the augmented
    ///      set when it lands.
    private func refresh(repo: String, prNumber: Int, client: APIClient, cache: TimelineCache, showLoading: Bool) async {
        if showLoading { isLoading = true }
        errorMessage = nil
        defer { if showLoading { isLoading = false } }

        let actors = await FeedData.actors(client: client, cache: cache)
        let cutoff = Calendar.current.date(byAdding: .day, value: -3, to: Date()) ?? Date().addingTimeInterval(-3 * 86_400)

        do {
            // Phase 1: core timeline from the fast PR-scoped fetch.
            let prEvents = try await client.fetchEventsForPR(repo: repo, prNumber: prNumber, limit: 100)
            let (byId, byLogin) = Self.actorMaps(actors)
            let core = Self.buildGroups(events: prEvents.filter { $0.createdAt >= cutoff },
                                        actorById: byId, actorByLogin: byLogin)
            publishAndCache(core, repo: repo, number: prNumber, cache: cache)

            // Phase 2: augment with push/changes-made rows. fetchEventsForPR's
            // pr_number filter excludes pushes (they carry a branch, not a PR
            // number), so we join them from the org-wide recent feed by
            // head_ref. This paged scan is the slow part — it runs after the
            // core is already on screen, not before.
            async let prLazy = try? await client.fetchPR(repo: repo, number: prNumber)
            let recent = await FeedData.recent(since: cutoff, client: client, cache: cache)
            let pr = await prLazy
            if Task.isCancelled { return }
            let changes = recent.filter { event in
                event.type == "github:push"
                    && event.repo?.lowercased() == repo.lowercased()
                    && Self.branchName(event.payload?.pushRef) == pr?.headRef
            }
            let full = Self.buildGroups(events: prEvents.filter { $0.createdAt >= cutoff } + changes,
                                        actorById: byId, actorByLogin: byLogin)
            publishAndCache(full, repo: repo, number: prNumber, cache: cache)
        } catch APIError.unauthorized {
            if groups.isEmpty { errorMessage = "Session expired. Sign in again from the menubar." }
        } catch {
            if groups.isEmpty { errorMessage = error.userFacingDescription }
        }
    }

    private func publishAndCache(_ built: [TimelineStore.TimelineGroup], repo: String, number: Int, cache: TimelineCache) {
        groups = built
        cache.setTimeline(repo: repo, number: number, groups: built)
    }

    private static func actorMaps(_ actors: [FeedActor]) -> (byId: [String: FeedActor], byLogin: [String: FeedActor]) {
        let byId = Dictionary(uniqueKeysWithValues: actors.map { ($0.id, $0) })
        let byLogin = Dictionary(uniqueKeysWithValues:
            actors.compactMap { a -> (String, FeedActor)? in
                guard let login = a.githubLogin?.lowercased() else { return nil }
                return (login, a)
            }
        )
        return (byId, byLogin)
    }

    // MARK: - Grouping

    /// Build a status-only ledger. Narrative posts, release notes, and review
    /// bodies are deliberately excluded: this screen answers only "what
    /// status changed, who changed it, and when?" Consecutive events that
    /// produce the same status collapse to the newest one.
    private static func buildGroups(
        events: [FeedEvent],
        actorById: [String: FeedActor],
        actorByLogin: [String: FeedActor]
    ) -> [TimelineGroup] {
        // Reconcile and webhooks can both insert the same raw event with
        // different delivery ids. Remove that duplicate before collapsing
        // consecutive equal statuses.
        var seenSignatures = Set<String>()
        let dedupped = events.sorted { $0.createdAt > $1.createdAt }.filter { event in
            guard needsDedup(event.type) else { return true }
            let sig = dedupKey(event)
            if seenSignatures.contains(sig) { return false }
            seenSignatures.insert(sig)
            return true
        }

        let statuses: [TimelineGroup] = dedupped.compactMap { event in
            let kind: TimelineGroup.Kind
            switch event.type {
            case "github:pr:opened": kind = .opened(isDraft: event.payload?.isDraft ?? false)
            case "github:pr:merged": kind = .merged
            case "github:pr:closed": kind = .closed
            case "github:pr:reopened": kind = .reopened
            case "github:pr:synchronize", "github:pr:changes_made", "github:push": kind = .changesMade
            case "github:pr:review:approved": kind = .reviewed(.approved)
            case "github:pr:review:changes_requested": kind = .reviewed(.changesRequested)
            case "github:pr:review:commented": kind = .reviewed(.commented)
            default: return nil
            }
            return lifecycleGroup(event, kind: kind, actorById: actorById, actorByLogin: actorByLogin)
        }

        var compact: [TimelineGroup] = []
        for status in statuses {
            if compact.last.map(statusKey) == statusKey(status) { continue }
            compact.append(status)
        }
        return compact
    }

    private static func statusKey(_ group: TimelineGroup) -> String {
        switch group.kind {
        case .opened(let draft): return draft ? "draft" : "opened"
        case .merged: return "merged"
        case .closed: return "closed"
        case .reopened: return "reopened"
        case .changesMade: return "changes-made"
        case .reviewed(.changesRequested): return "changes-requested"
        case .reviewed(_) where group.isBot: return "bot-reviewed"
        case .reviewed(.approved): return "approved"
        case .reviewed(.commented): return "reviewed"
        }
    }

    private static func lifecycleGroup(
        _ event: FeedEvent,
        kind: TimelineGroup.Kind,
        actorById: [String: FeedActor],
        actorByLogin: [String: FeedActor]
    ) -> TimelineGroup? {
        let actor = resolveActor(event, actorById: actorById, actorByLogin: actorByLogin)
        return TimelineGroup(
            id: "\(event.id)-\(event.type)",
            kind: kind,
            createdAt: event.createdAt,
            actorLogin: actor.login,
            actorAvatarUrl: actor.avatar,
            isBot: actor.isBot
        )
    }

    // MARK: - Helpers

    private static func resolveActor(
        _ event: FeedEvent,
        actorById: [String: FeedActor],
        actorByLogin: [String: FeedActor]
    ) -> (login: String?, avatar: String?, isBot: Bool) {
        // Review events belong to the reviewer, while payload.authorLogin
        // is normally the PR author. Prefer reviewerLogin so bot reviews
        // and human reviews receive the correct title and avatar.
        let payloadLogin = event.payload?.reviewerLogin
            ?? event.payload?.pusherLogin
            ?? event.payload?.authorLogin
        var actor: FeedActor? = event.actorId.flatMap { actorById[$0] }
        if actor == nil, let login = payloadLogin?.lowercased() {
            actor = actorByLogin[login]
        }
        let login = actor?.displayName ?? payloadLogin
        let isBot = actor?.kind?.lowercased() == "bot" || PRActivity.isBot(actor?.githubLogin ?? login)
        return (login,
                actor?.avatarUrl ?? event.payload?.authorAvatarUrl,
                isBot)
    }

    /// Types that can arrive once from a webhook and again from reconcile.
    private static func needsDedup(_ type: String) -> Bool {
        type.hasPrefix("github:pr:review:")
            || type == "github:pr:opened"
            || type == "github:pr:merged"
            || type == "github:pr:closed"
            || type == "github:pr:reopened"
    }

    /// Signature that identifies a "same" event across webhook + reconcile
    /// sources. Actor login + type + timestamp bucketed to the minute:
    /// same person doing the same thing at the same moment. Reviews have
    /// a review body but reconcile may write a differently-truncated
    /// version, so we intentionally do NOT key on body.
    private static func dedupKey(_ event: FeedEvent) -> String {
        let login = event.payload?.reviewerLogin
            ?? event.payload?.pusherLogin
            ?? event.payload?.authorLogin
            ?? event.actorId
            ?? "?"
        let minute = Int(event.createdAt.timeIntervalSince1970 / 60)
        return "\(event.type)|\(login)|\(minute)"
    }

    private static func branchName(_ ref: String?) -> String? {
        guard let ref, !ref.isEmpty else { return nil }
        return ref.hasPrefix("refs/heads/") ? String(ref.dropFirst("refs/heads/".count)) : ref
    }
}
