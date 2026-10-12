import SwiftUI
import AppKit

/// PR detail view rendered when AppState.prTarget is set. GitHub remains in
/// the user's default browser; NoxHere supplies a safe projection for the
/// native overview, timeline, and conversation tabs.
struct PRDetailView: View {
    let pr: PRRef
    let onBack: () -> Void

    @EnvironmentObject private var state: AppState
    @State private var selectedTab: DetailTab = .pr

    private enum DetailTab: String, CaseIterable, Identifiable {
        case pr = "PR"
        case timeline = "Timeline"
        case comments = "Comments"

        var id: Self { self }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(UT.border)
            tabBar
            Divider().overlay(UT.borderSoft)
            tabContent
        }
        .background(UT.surface)
        .onChange(of: pr.id) { _, _ in selectedTab = .pr }
    }

    private var tabBar: some View {
        Picker("PR detail", selection: $selectedTab) {
            ForEach(DetailTab.allCases) { tab in
                Text(tab.rawValue).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(UT.card)
        .accessibilityLabel("PR detail view")
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .pr:
            PROverviewView(pr: pr).environmentObject(state)
        case .timeline:
            TimelineView(pr: pr).environmentObject(state)
        case .comments:
            PRCommentsView(pr: pr).environmentObject(state)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button(action: onBack) {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold))
                    Text("Back").font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(UT.accent)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 1) {
                Text("\(pr.repo) #\(pr.number)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                if let title = pr.title, !title.isEmpty {
                    Text(title)
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            Button {
                if let u = pr.githubURL { NSWorkspace.shared.open(u) }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.right.square").font(.system(size: 11))
                    Text("Open on GitHub").font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(UT.accent)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open the PR in your default browser (uses your real GitHub session)")
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(UT.card)
    }
}
