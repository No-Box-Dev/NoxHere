import AppKit
import SwiftUI

struct IssueSegment<Option: IssueSegmentOption>: View {
    @Binding var selection: Option
    let options: [Option]

    var body: some View {
        HStack(spacing: 1) {
            ForEach(options) { option in
                Button {
                    selection = option
                } label: {
                    Text(option.label)
                        .font(.system(size: 10, weight: .semibold))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .foregroundStyle(selection == option ? UT.onAccent : UT.textMuted)
                        .padding(.horizontal, 9)
                        .frame(height: 25)
                        .background(RoundedRectangle(cornerRadius: 5).fill(selection == option ? UT.accent : Color.clear))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .cardStyle(cornerRadius: 7)
    }
}

struct IssueBucket: Identifiable {
    static let unassigned = "__unassigned__"

    let id: String
    let title: String
    let avatarURL: String?
    let issues: [Issue]
    let staleDays: Int

    var count: Int { issues.count }
    var criticalCount: Int { issues.filter(\.isCritical).count }
    var staleCount: Int { issues.filter { issueAge($0) > staleDays }.count }
    var averageAge: Int {
        guard !issues.isEmpty else { return 0 }
        return issues.map(issueAge).reduce(0, +) / issues.count
    }
}

struct IssueBucketCard: View {
    let bucket: IssueBucket
    let groupBy: IssueGrouping
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 9) {
                    bucketIcon
                    VStack(alignment: .leading, spacing: 2) {
                        Text(groupBy == .people && bucket.id != IssueBucket.unassigned ? "@\(bucket.title)" : bucket.title)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(UT.textPrimary)
                            .lineLimit(1)
                        Text("\(bucket.count) \(bucket.count == 1 ? "issue" : "issues")")
                            .font(.system(size: 10))
                            .foregroundStyle(UT.textTertiary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 9)).foregroundStyle(UT.textTertiary)
                }
                HStack(spacing: 14) {
                    IssueMetric(value: bucket.count, label: "total")
                    IssueMetric(value: bucket.averageAge, label: "avg age (d)")
                    if bucket.criticalCount > 0 { IssueMetric(value: bucket.criticalCount, label: "critical", color: .red) }
                    if bucket.staleCount > 0 { IssueMetric(value: bucket.staleCount, label: "stale", color: UT.warnText) }
                }
            }
            .padding(11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 9)
                    .fill(bucket.id == IssueBucket.unassigned ? UT.warnBg.opacity(0.55) : UT.card)
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(bucket.id == IssueBucket.unassigned ? UT.warnBorder : UT.border))
            )
            .contentShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var bucketIcon: some View {
        if bucket.id == IssueBucket.unassigned {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 20))
                .foregroundStyle(UT.warnText)
                .frame(width: 30, height: 30)
                .background(Circle().fill(UT.warnBg))
        } else if groupBy == .repo {
            Image(systemName: "folder.fill")
                .font(.system(size: 14))
                .foregroundStyle(UT.textMuted)
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: 7).fill(UT.borderSoft))
        } else {
            Avatar(url: bucket.avatarURL, initials: String(bucket.title.prefix(1)).uppercased(), size: 30)
        }
    }
}

private struct IssueMetric: View {
    let value: Int
    let label: String
    var color: Color = UT.textPrimary

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(String(value)).font(.system(size: 15, weight: .bold)).foregroundStyle(color)
            Text(label.uppercased()).font(.system(size: 7, weight: .bold)).foregroundStyle(color.opacity(0.72))
        }
    }
}

struct IssueListRow: View {
    let issue: Issue
    let staleDays: Int

    var body: some View {
        Button {
            if let url = URL(string: issue.displayUrl) { NSWorkspace.shared.open(url) }
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: issue.isCritical ? "flag.fill" : "smallcircle.filled.circle")
                    .font(.system(size: 11))
                    .foregroundStyle(issue.isCritical ? Color.red : UT.successText)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 4) {
                    Text(issue.displayTitle)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(UT.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        PillView(text: "\(issue.displayRepo) #\(issue.displayNumber)", style: .accent)
                        Text("\(issueAge(issue))d")
                            .font(.system(size: 9, weight: issueAge(issue) > staleDays ? .semibold : .regular))
                            .foregroundStyle(issueAge(issue) > staleDays ? UT.warnText : UT.textTertiary)
                        Spacer()
                        Image(systemName: "arrow.up.right.square").font(.system(size: 9)).foregroundStyle(UT.textTertiary)
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

func issueAge(_ issue: Issue) -> Int {
    guard let date = DisplayDateFormatter.parse(issue.createdAt ?? "") else { return 0 }
    return max(0, Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0)
}
