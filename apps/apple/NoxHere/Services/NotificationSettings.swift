import Foundation
import Combine

/// User-facing notification toggles, persisted in UserDefaults. Device-level
/// (not per account/org) — the notifier applies them to whatever account+org
/// is active.
@MainActor
final class NotificationSettings: ObservableObject {
    @Published var enabled: Bool { didSet { save("enabled", enabled) } }
    @Published var newPRs: Bool { didSet { save("newPRs", newPRs) } }
    @Published var newPRsSkipDrafts: Bool { didSet { save("newPRsSkipDrafts", newPRsSkipDrafts) } }
    @Published var newPRsSkipOwn: Bool { didSet { save("newPRsSkipOwn", newPRsSkipOwn) } }
    @Published var myPRMerged: Bool { didSet { save("myPRMerged", myPRMerged) } }
    @Published var myPRClosed: Bool { didSet { save("myPRClosed", myPRClosed) } }
    @Published var reviewsOnMyPRs: Bool { didSet { save("reviewsOnMyPRs", reviewsOnMyPRs) } }
    @Published var issuesAssigned: Bool { didSet { save("issuesAssigned", issuesAssigned) } }
    @Published var reviewRequests: Bool { didSet { save("reviewRequests", reviewRequests) } }
    /// Deliver as Time Sensitive so banners break through Focus modes.
    @Published var timeSensitive: Bool { didSet { save("timeSensitive", timeSensitive) } }
    @Published var playSound: Bool { didSet { save("playSound", playSound) } }

    private static let prefix = "planning-feed.notify."

    init() {
        enabled = Self.load("enabled")
        newPRs = Self.load("newPRs")
        newPRsSkipDrafts = Self.load("newPRsSkipDrafts")
        newPRsSkipOwn = Self.load("newPRsSkipOwn")
        myPRMerged = Self.load("myPRMerged")
        myPRClosed = Self.load("myPRClosed")
        reviewsOnMyPRs = Self.load("reviewsOnMyPRs")
        issuesAssigned = Self.load("issuesAssigned")
        reviewRequests = Self.load("reviewRequests")
        timeSensitive = Self.load("timeSensitive")
        playSound = Self.load("playSound", default: false)
    }

    /// Toggles default to on (sound is the exception — silent by default);
    /// only an explicit user choice is stored.
    private static func load(_ key: String, default defaultValue: Bool = true) -> Bool {
        UserDefaults.standard.object(forKey: prefix + key) as? Bool ?? defaultValue
    }

    private func save(_ key: String, _ value: Bool) {
        UserDefaults.standard.set(value, forKey: Self.prefix + key)
    }
}
