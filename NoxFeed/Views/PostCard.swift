import SwiftUI
import AppKit

struct PostCard: View {
    let event: FeedEvent
    let actor: FeedActor?
    @EnvironmentObject private var state: AppState

    var body: some View {
        // Card click navigates INSIDE the popover — sets state.prTarget
        // and RootView swaps in the PR Timeline in place. When we can't
        // resolve a PRRef we do nothing rather than send the user to an
        // unrelated view.
        if let pr = prRef {
            Button { state.prTarget = pr } label: { cardBody }
                .buttonStyle(.plain)
                .help("Open Timeline for this PR")
        } else {
            cardBody
        }
    }

    private var cardBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
                .overlay(UT.borderSoft)
                .padding(.top, 10)
                .padding(.bottom, 12)
            Text(event.summary.isEmpty ? "(no summary)" : event.summary)
                .font(.system(size: 13))
                .foregroundStyle(UT.textBody)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let (title, _) = destinationLink {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.forward.app").font(.system(size: 10))
                    Text(title).font(.system(size: 11)).lineLimit(1)
                }
                .foregroundStyle(UT.accent)
                .padding(.top, 8)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
        .contentShape(RoundedRectangle(cornerRadius: 12))
    }

    private var prRef: PRRef? {
        guard let org = event.org, let repo = event.repo, let n = event.payload?.prNumber else { return nil }
        return PRRef(org: org, repo: repo, number: n, title: event.payload?.prTitle)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Avatar(url: displayAvatarUrl, initials: initials, size: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let repo = event.repo { PillView(text: repo, style: .accent) }
                    if let trigger = triggerLabel {
                        PillView(text: trigger, style: .mono)
                    }
                }
            }
            Spacer(minLength: 0)
            Text(DisplayDateFormatter.string(for: event.createdAt))
                .font(.system(size: 10))
                .foregroundStyle(UT.textTertiary)
        }
    }

    // MARK: - Derived fields

    private var displayName: String {
        if let actor {
            let n = actor.displayName
            if !n.isEmpty { return n }
        }
        if let login = event.payload?.authorLogin, !login.isEmpty { return login }
        if let actorId = event.actorId, !actorId.isEmpty { return actorId }
        return "unknown"
    }

    private var displayAvatarUrl: String? {
        if let a = actor?.avatarUrl, !a.isEmpty { return a }
        return event.payload?.authorAvatarUrl
    }

    private var initials: String {
        let src = displayName
        guard let first = src.first else { return "?" }
        return String(first).uppercased()
    }

    private var triggerLabel: String? {
        switch event.type {
        case "pr_narrative": return "pr:opened"
        case "narrative": return "pr:merged"
        case "release_notes": return "release-notes"
        default: return nil
        }
    }

    /// GitHub link — prefer explicit prUrl from the payload, otherwise
    /// synthesize from org + repo + prNumber so every PR-derived event has
    /// a link.
    private var destinationLink: (String, URL)? {
        if let urlStr = event.payload?.prUrl, let url = URL(string: urlStr), !urlStr.isEmpty {
            let title = event.payload?.prTitle.flatMap { $0.isEmpty ? nil : $0 } ?? shortLabel
            return (title, url)
        }
        if let org = event.org, let repo = event.repo, let n = event.payload?.prNumber {
            if let url = URL(string: "https://github.com/\(org)/\(repo)/pull/\(n)") {
                return ("View PR #\(n) on GitHub", url)
            }
        }
        return nil
    }

    private var shortLabel: String {
        if let n = event.payload?.prNumber { return "View PR #\(n) on GitHub" }
        return "View on GitHub"
    }

}

// MARK: - Pill

enum PillStyle { case accent, mono, warn, success, bronze }

struct PillView: View {
    let text: String
    let style: PillStyle

    var body: some View {
        Text(text)
            .font(pillFont)
            .foregroundStyle(fg)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(bg)
                    .overlay(Capsule().stroke(stroke, lineWidth: 1))
            )
    }

    private var pillFont: Font {
        switch style {
        case .mono: return .system(size: 10, weight: .regular, design: .monospaced)
        default: return .system(size: 10, weight: .semibold)
        }
    }

    private var fg: Color {
        switch style {
        case .accent: return UT.accent
        case .mono: return UT.textMuted
        case .warn: return UT.warnText
        case .success: return UT.successText
        case .bronze: return UT.bronzeText
        }
    }

    private var bg: Color {
        switch style {
        case .accent: return UT.accentSoft
        case .mono: return UT.borderSoft
        case .warn: return UT.warnBg
        case .success: return UT.successBg
        case .bronze: return UT.bronzeBg
        }
    }

    private var stroke: Color {
        switch style {
        case .accent: return UT.accent.opacity(0.35)
        case .mono: return UT.border
        case .warn: return UT.warnBorder
        case .success: return UT.successBorder
        case .bronze: return UT.bronzeBorder
        }
    }
}

// MARK: - Avatar

struct Avatar: View {
    let url: String?
    let initials: String
    let size: CGFloat

    var body: some View {
        // Layout anchor is an explicit-size Color.clear so nothing inside
        // can grow the container. AsyncImage renders as an overlay — the
        // overlay is proposed the anchor's exact size, aspect-fills within
        // it, and the outer clipShape rounds the result.
        //
        // Two quality fixes on top of the layout pattern:
        //   1. Rewrite GitHub avatar URLs with `?s=<size*3>` so the server
        //      returns a right-sized image instead of us downscaling a
        //      460×460 blob to ~30pt (the default downscale filter is
        //      lousy at that ratio — visible jaggies + distortion).
        //   2. `.interpolation(.high)` for the residual scale, so what
        //      downscale we do use Lanczos-quality.
        Color.clear
            .frame(width: size, height: size)
            .overlay {
                AsyncImage(url: sizedURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .interpolation(.high)
                            .aspectRatio(contentMode: .fill)
                    case .empty, .failure, _:
                        ZStack {
                            Circle().fill(UT.accentSoft)
                            Text(initials)
                                .font(.system(size: size * 0.42, weight: .semibold))
                                .foregroundStyle(UT.accent)
                        }
                    }
                }
            }
            .clipShape(Circle())
    }

    /// If the URL is a GitHub avatar (githubusercontent.com), append or
    /// replace `s=<size*3>` so the server delivers a right-sized image
    /// instead of the default 460×460. `*3` is enough headroom for retina
    /// + super-retina without over-fetching.
    private var sizedURL: URL? {
        guard let raw = url, !raw.isEmpty, var comps = URLComponents(string: raw) else {
            return nil
        }
        if comps.host?.contains("githubusercontent.com") == true {
            let target = Int((size * 3).rounded())
            var items = (comps.queryItems ?? []).filter { $0.name != "s" }
            items.append(URLQueryItem(name: "s", value: String(target)))
            comps.queryItems = items
        }
        return comps.url
    }
}
