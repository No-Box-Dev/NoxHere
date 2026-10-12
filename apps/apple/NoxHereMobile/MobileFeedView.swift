import SwiftUI

@MainActor
private final class MobileFeedModel: ObservableObject {
    @Published var mode: FeedMode = .posts
    @Published var events: [FeedEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var canLoadMore = false
    private var cursor: String?

    func load(client: APIClient, refresh: Bool = true) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let page = try await client.fetchFeed(
                mode: mode,
                limit: 25,
                before: refresh ? nil : cursor
            )
            if refresh {
                events = page.events
            } else {
                let existing = Set(events.map(\.id))
                events.append(contentsOf: page.events.filter { !existing.contains($0.id) })
            }
            cursor = page.nextCursor
            canLoadMore = page.events.count == 25 && cursor != nil
        } catch {
            errorMessage = error.userFacingDescription
        }
    }
}

struct MobileFeedView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.openURL) private var openURL
    @StateObject private var model = MobileFeedModel()

    private let modes: [FeedMode] = [.posts, .opened, .releaseNotes]

    var body: some View {
        List {
            Picker("Feed", selection: $model.mode) {
                ForEach(modes) { mode in Text(mode.label).tag(mode) }
            }
            .pickerStyle(.segmented)
            .listRowSeparator(.hidden)

            if let error = model.errorMessage, model.events.isEmpty {
                ContentUnavailableView("Couldn’t load feed", systemImage: "wifi.exclamationmark", description: Text(error))
                    .listRowSeparator(.hidden)
            } else if model.events.isEmpty && !model.isLoading {
                ContentUnavailableView("Nothing here yet", systemImage: "rectangle.stack")
                    .listRowSeparator(.hidden)
            } else {
                ForEach(model.events) { event in
                    Button {
                        if let raw = event.payload?.prUrl, let url = URL(string: raw) { openURL(url) }
                    } label: {
                        MobileEventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }

                if model.canLoadMore {
                    Button("Load more") {
                        Task { await model.load(client: state.makeAPIClient(), refresh: false) }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .listStyle(.plain)
        .overlay { if model.isLoading && model.events.isEmpty { ProgressView() } }
        .navigationTitle(state.activeOrg ?? "NoxHere")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await model.load(client: state.makeAPIClient()) } } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(model.isLoading)
            }
        }
        .task(id: "\(state.activeLogin ?? "")/\(state.activeOrg ?? "")/\(model.mode.rawValue)") {
            await model.load(client: state.makeAPIClient())
        }
        .refreshable { await model.load(client: state.makeAPIClient()) }
    }
}

private struct MobileEventRow: View {
    let event: FeedEvent

    private var icon: String {
        switch event.type {
        case let type where type.contains("merged"): "arrow.triangle.merge"
        case let type where type.contains("opened"): "arrow.branch"
        case let type where type.contains("review"): "checkmark.bubble"
        default: "circle.fill"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .frame(width: 28, height: 28)
                .foregroundStyle(MobileTheme.accent)
                .background(MobileTheme.accent.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 5) {
                Text(event.summary.isEmpty ? event.type : event.summary)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let repo = event.repo { Text(repo) }
                    Text(DisplayDateFormatter.string(for: event.createdAt))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 5)
    }
}
