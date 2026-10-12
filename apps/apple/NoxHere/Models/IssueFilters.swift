import Foundation

enum IssueScope: String, CaseIterable, Identifiable, IssueSegmentOption {
    case all, me

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum IssueStatus: String, CaseIterable, Identifiable, IssueSegmentOption {
    case open, closed

    var id: String { rawValue }
    var label: String { self == .open ? "Open" : "Closed (30d)" }

    var closedSince: Date? {
        guard self == .closed else { return nil }
        return Calendar.current.date(byAdding: .day, value: -30, to: Date())
    }
}

enum IssueGrouping: String, CaseIterable, Identifiable, IssueSegmentOption {
    case people, repo

    var id: String { rawValue }
    var label: String { self == .people ? "By People" : "By Repo" }
}

protocol IssueSegmentOption: Hashable, Identifiable {
    var label: String { get }
}
