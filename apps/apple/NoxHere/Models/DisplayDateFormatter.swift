import Foundation

/// Shared display-only formatters. Constructing these for every SwiftUI row
/// is comparatively expensive; all current callers run on the main actor.
enum DisplayDateFormatter {
    static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter
    }()

    static func parse(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return isoFractional.date(from: value) ?? isoPlain.date(from: value)
    }

    static func string(for date: Date, relativeTo reference: Date = Date()) -> String {
        relative.localizedString(for: date, relativeTo: reference)
    }
}
