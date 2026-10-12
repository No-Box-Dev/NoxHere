import Foundation
import UserNotifications

/// App-lifetime notifier. Polls the backend on its own cadence — independent
/// of which view (if any) is open — and fires directed native notifications
/// according to NotificationSettings. One instance per app; the active
/// (login, org) scope is resolved per tick, and every baseline is stored per
/// scope, so account/org switches never replay another scope's backlog.
///
/// Three sources per tick:
///   - /api/v1/events (one unfiltered fetch, id watermark): new PRs, my PR
///     merged, reviews on my PRs.
///   - /api/v1/issues?assignee=me (seen-id set): issues assigned to me.
///   - /api/v1/prs?state=open (seen-key set): review requests aimed at me.
@MainActor
final class NotifierStore: ObservableObject {
    let settings = NotificationSettings()

    private var clientProvider: (() -> APIClient?)?
    private var loginProvider: (() -> String?)?
    private var orgProvider: (() -> String?)?
    private var pollTask: Task<Void, Never>?

    private static let eventKeyPrefix = "planning-feed.notifier.lastEventId"
    private static let issuesKeyPrefix = "planning-feed.notifier.seenIssues"
    private static let requestsKeyPrefix = "planning-feed.notifier.seenReviewRequests"
    /// Per-source cap per tick so an outage recovery can't bury the user.
    private static let maxPerTick = 5

    /// Returns immediately; permission prompt and poll loop run in their own
    /// task so launch-time callers aren't blocked on network round-trips.
    func start(
        client: @escaping () -> APIClient?,
        login: @escaping () -> String?,
        org: @escaping () -> String?
    ) {
        clientProvider = client
        loginProvider = login
        orgProvider = org
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            do {
                _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                let s = await UNUserNotificationCenter.current().notificationSettings()
                NSLog("[NotifierStore] auth=\(s.authorizationStatus.rawValue) alertSetting=\(s.alertSetting.rawValue) style=\(s.alertStyle.rawValue) sound=\(s.soundSetting.rawValue) notifCenter=\(s.notificationCenterSetting.rawValue)")
                // Debug hook: `open NoxHere.app --args --test-notification`
                // fires one test banner at launch — same path as the settings
                // pane's test button.
                if ProcessInfo.processInfo.arguments.contains("--test-notification") {
                    await self?.sendTestNotification()
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    let delivered = await UNUserNotificationCenter.current().deliveredNotifications()
                    NSLog("[NotifierStore] delivered in Notification Center: \(delivered.count) — \(delivered.map(\.request.identifier).joined(separator: ","))")
                }
            } catch {
                // Typically UNErrorDomain code 1 ("notifications not
                // allowed") when the binary runs from a non-LS-registered
                // location like DerivedData. Run from /Applications.
                NSLog("[NotifierStore] requestAuthorization failed: \(error)")
            }
            while !Task.isCancelled {
                await self?.pollOnce()
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                if Task.isCancelled { return }
            }
        }
    }

    // MARK: - Poll

    private func pollOnce() async {
        guard settings.enabled else { return }
        guard let client = clientProvider?(),
              let me = loginProvider?()?.lowercased(), !me.isEmpty,
              let org = orgProvider?(), !org.isEmpty
        else {
            NSLog("[NotifierStore] tick skipped: no client/login/org yet")
            return
        }
        let scope = "\(me)/\(org)"

        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else {
            NSLog("[NotifierStore] tick skipped: notifications not authorized (status=\(status.rawValue))")
            return
        }

        // Each source fails independently and silently — a flaky poll tick
        // just tries again next time; baselines only advance on success.
        async let eventCheck: Void = checkEvents(client: client, me: me, org: org, scope: scope)
        async let issueCheck: Void = settings.issuesAssigned
            ? checkAssignedIssues(client: client, me: me, scope: scope)
            : ()
        async let requestCheck: Void = settings.reviewRequests
            ? checkReviewRequests(client: client, me: me, scope: scope)
            : ()
        _ = await (eventCheck, issueCheck, requestCheck)
    }

    // MARK: - Event-driven (new PRs, my PR merged, reviews on my PRs)

    private func checkEvents(client: APIClient, me: String, org: String, scope: String) async {
        let page: FeedPage
        do {
            page = try await client.fetchRecentEvents(limit: 200)
        } catch {
            NSLog("[NotifierStore] events fetch failed: \(error)")
            return
        }
        let key = "\(Self.eventKeyPrefix).\(scope)"
        guard let maxId = page.events.map(\.id).max() else {
            NSLog("[NotifierStore] events fetch returned 0 rows")
            return
        }

        // First tick for this scope: swallow the backlog silently.
        guard let stored = UserDefaults.standard.object(forKey: key) as? Int else {
            NSLog("[NotifierStore] baseline set for \(scope): \(maxId)")
            UserDefaults.standard.set(Int(maxId), forKey: key)
            return
        }
        let watermark = Int64(stored)

        let fresh: [FeedEvent]
        do {
            fresh = try await client.fetchRecentEvents(after: watermark, startingWith: page)
                .sorted { $0.id < $1.id }
        } catch {
            NSLog("[NotifierStore] event pagination failed: \(error)")
            return
        }
        NSLog("[NotifierStore] tick \(scope): watermark=\(watermark) fresh=\(fresh.count) types=\(fresh.map(\.type).joined(separator: ","))")
        var delivered = 0
        var processedIds: [Int64] = []
        for event in fresh {
            guard delivered < Self.maxPerTick else { break }
            processedIds.append(event.id)
            if await notifyIfRelevant(event: event, me: me, org: org) {
                delivered += 1
            }
        }
        if delivered > 0 { NSLog("[NotifierStore] delivered \(delivered) notifications") }
        // Only checkpoint events we actually examined. Advancing directly to
        // maxId after hitting maxPerTick would permanently discard the rest
        // of a busy notification burst.
        let checkpoint = NotificationDeliveryProgress.eventCheckpoint(
            previous: watermark,
            processed: processedIds
        )
        UserDefaults.standard.set(Int(checkpoint), forKey: key)
    }

    /// Returns true when a notification was actually posted.
    private func notifyIfRelevant(event: FeedEvent, me: String, org: String) async -> Bool {
        let payload = event.payload
        let author = payload?.authorLogin?.lowercased()

        switch event.type {
        case "github:pr:opened":
            guard settings.newPRs else { return false }
            if settings.newPRsSkipDrafts && payload?.isDraft == true { return false }
            if settings.newPRsSkipOwn && author == me { return false }
            await deliver(
                id: "notifier-\(event.id)",
                title: "\(payload?.authorLogin ?? "Someone") opened a PR",
                body: prLine(event: event),
                url: prUrl(event: event, org: org)
            )
            return true

        case "github:pr:merged":
            guard settings.myPRMerged, author == me else { return false }
            await deliver(
                id: "notifier-\(event.id)",
                title: "Your PR was merged 🎉",
                body: prLine(event: event),
                url: prUrl(event: event, org: org)
            )
            return true

        // The backend only emits github:pr:closed for closed-WITHOUT-merge;
        // a merge close arrives as github:pr:merged.
        case "github:pr:closed":
            guard settings.myPRClosed, author == me else { return false }
            await deliver(
                id: "notifier-\(event.id)",
                title: "Your PR was closed without merging",
                body: prLine(event: event),
                url: prUrl(event: event, org: org)
            )
            return true

        case "github:pr:review:approved", "github:pr:review:changes_requested", "github:pr:review:commented":
            guard settings.reviewsOnMyPRs, author == me else { return false }
            let reviewer = payload?.reviewerLogin
            if reviewer?.lowercased() == me { return false }
            let verb: String
            switch payload?.reviewState {
            case "approved": verb = "approved your PR"
            case "changes_requested": verb = "requested changes on your PR"
            default: verb = "reviewed your PR"
            }
            await deliver(
                id: "notifier-\(event.id)",
                title: "\(reviewer ?? "Someone") \(verb)",
                body: prLine(event: event),
                url: prUrl(event: event, org: org)
            )
            return true

        default:
            return false
        }
    }

    private func prLine(event: FeedEvent) -> String {
        let repo = event.repo ?? "?"
        if let number = event.payload?.prNumber {
            let title = event.payload?.prTitle ?? event.summary
            return "\(repo) #\(number): \(title)"
        }
        return event.summary.isEmpty ? repo : event.summary
    }

    private func prUrl(event: FeedEvent, org: String) -> String? {
        if let url = event.payload?.prUrl { return url }
        guard let repo = event.repo, let number = event.payload?.prNumber else { return nil }
        return "https://github.com/\(org)/\(repo)/pull/\(number)"
    }

    // MARK: - Issues assigned to me

    private func checkAssignedIssues(client: APIClient, me: String, scope: String) async {
        guard let issues = try? await client.fetchMyIssues(login: me) else { return }
        let key = "\(Self.issuesKeyPrefix).\(scope)"
        let currentIds = issues.map { Int($0.id) }

        guard let seen = UserDefaults.standard.array(forKey: key) as? [Int] else {
            UserDefaults.standard.set(currentIds, forKey: key)
            return
        }
        let seenSet = Set(seen)
        let fresh = issues.filter { !seenSet.contains(Int($0.id)) }
        let deliveredIssues = Array(fresh.prefix(Self.maxPerTick))
        for issue in deliveredIssues {
            await deliver(
                id: "notifier-issue-\(issue.id)",
                title: "Issue assigned to you",
                body: "\(issue.displayRepo) #\(issue.displayNumber): \(issue.displayTitle)",
                url: issue.displayUrl.isEmpty ? nil : issue.displayUrl
            )
        }
        // Retain only previously-seen or just-delivered open issues. New items
        // beyond maxPerTick remain unseen and are delivered on a later tick.
        // Closed issues still drop out, so a future re-assignment notifies.
        let nextSeen = NotificationDeliveryProgress.retainedSeen(
            current: currentIds,
            previouslySeen: seenSet,
            delivered: deliveredIssues.map { Int($0.id) }
        )
        UserDefaults.standard.set(nextSeen, forKey: key)
    }

    // MARK: - Review requests aimed at me

    private func checkReviewRequests(client: APIClient, me: String, scope: String) async {
        guard let prs = try? await client.fetchOpenPRs() else { return }
        let key = "\(Self.requestsKeyPrefix).\(scope)"

        let mine = prs.filter { pr in
            pr.author?.lowercased() != me
                && pr.reviewerLogins.contains { $0.lowercased() == me }
        }
        let currentKeys = mine.map { "\($0.displayRepo)#\($0.displayNumber)" }

        guard let seen = UserDefaults.standard.stringArray(forKey: key) else {
            UserDefaults.standard.set(currentKeys, forKey: key)
            return
        }
        let seenSet = Set(seen)
        let fresh = zip(mine, currentKeys).filter { !seenSet.contains($0.1) }
        let deliveredRequests = Array(fresh.prefix(Self.maxPerTick))
        for (pr, prKey) in deliveredRequests {
            await deliver(
                id: "notifier-review-request-\(prKey)",
                title: "\(pr.author ?? "Someone") requested your review",
                body: "\(pr.displayRepo) #\(pr.displayNumber): \(pr.displayTitle)",
                url: pr.displayUrl.isEmpty ? nil : pr.displayUrl
            )
        }
        let nextSeen = NotificationDeliveryProgress.retainedSeen(
            current: currentKeys,
            previouslySeen: seenSet,
            delivered: deliveredRequests.map { $0.1 }
        )
        UserDefaults.standard.set(nextSeen, forKey: key)
    }

    // MARK: - Delivery

    /// Fired by the "Send test notification" button in settings so users can
    /// verify end-to-end delivery (permission + Focus + notification style).
    func sendTestNotification() async {
        await deliver(
            id: "notifier-test-\(UUID().uuidString)",
            title: "NoxHere test notification",
            body: "Delivery works. You'll get PR and issue updates like this.",
            url: nil
        )
    }

    private func deliver(id: String, title: String, body: String, url: String?) async {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        if settings.playSound {
            content.sound = .default
        }
        if settings.timeSensitive {
            content.interruptionLevel = .timeSensitive
        }
        if let url { content.userInfo = ["url": url] }
        let request = UNNotificationRequest(identifier: id, content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }
}

/// Pure notification cursor logic, kept separate from UserNotifications so
/// burst handling can be tested deterministically.
enum NotificationDeliveryProgress {
    static func eventCheckpoint(previous: Int64, processed: [Int64]) -> Int64 {
        max(previous, processed.max() ?? previous)
    }

    static func retainedSeen<Value: Hashable>(
        current: [Value],
        previouslySeen: Set<Value>,
        delivered: [Value]
    ) -> [Value] {
        let deliveredSet = Set(delivered)
        return current.filter { previouslySeen.contains($0) || deliveredSet.contains($0) }
    }
}
