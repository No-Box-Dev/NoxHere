import SwiftUI

struct GlobalSearchView: View {
    let query: String
    let results: [GlobalSearchResult]
    let isLoading: Bool
    let errorMessage: String?
    let selectedID: String?
    let onSelect: (GlobalSearchResult) -> Void
    let onRetry: () -> Void

    private var grouped: [(GlobalSearchKind, [GlobalSearchResult])] {
        GlobalSearchKind.allCases.compactMap { kind in
            let matches = results.filter { $0.kind == kind }
            return matches.isEmpty ? nil : (kind, matches)
        }
    }

    var body: some View {
        Group {
            if isLoading && results.isEmpty {
                VStack(spacing: 9) {
                    ProgressView().controlSize(.small)
                    Text("Searching everything…")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, results.isEmpty {
                RetryErrorView(message: errorMessage, retry: onRetry)
            } else if results.isEmpty {
                EmptyStateCard(text: "No people, pull requests, issues, features, posts, or release notes match \"\(query)\".")
                    .padding(14)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4, pinnedViews: [.sectionHeaders]) {
                        ForEach(grouped, id: \.0) { kind, matches in
                            Section {
                                ForEach(matches) { result in
                                    Button { onSelect(result) } label: {
                                        GlobalSearchRow(result: result, isSelected: result.id == selectedID)
                                    }
                                    .buttonStyle(.plain)
                                }
                            } header: {
                                Text(kind.sectionTitle.uppercased())
                                    .font(.system(size: 9, weight: .bold))
                                    .tracking(0.7)
                                    .foregroundStyle(UT.textTertiary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 8)
                                    .padding(.top, 10)
                                    .padding(.bottom, 3)
                                    .background(UT.surface)
                            }
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.bottom, 12)
                }
                .overlay(alignment: .topTrailing) {
                    if isLoading { ProgressView().controlSize(.mini).padding(10) }
                }
            }
        }
        .accessibilityLabel("Global search results")
    }
}

private struct GlobalSearchRow: View {
    let result: GlobalSearchResult
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            if result.kind == .person {
                Avatar(url: result.avatarUrl, initials: initials, size: 30)
            } else {
                Image(systemName: result.kind.systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(iconColor)
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 7).fill(iconColor.opacity(0.12)))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(result.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(UT.textPrimary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(result.subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textMuted)
                    .lineLimit(1)
            }
            if let state = result.state {
                PillView(text: state.capitalized, style: state == "open" ? .success : .mono)
            }
            Image(systemName: "return")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(UT.textTertiary)
                .opacity(isSelected ? 1 : 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 8).fill(isSelected ? UT.accentSoft : Color.clear))
        .contentShape(Rectangle())
    }

    private var initials: String {
        String((result.personLogin ?? result.title).prefix(2)).uppercased()
    }

    private var iconColor: Color {
        switch result.kind {
        case .pullRequest: return UT.violet
        case .issue: return UT.coral
        case .feature: return UT.accent
        case .post: return UT.bronzeText
        case .releaseNote: return UT.successText
        case .person: return UT.accent
        }
    }
}
