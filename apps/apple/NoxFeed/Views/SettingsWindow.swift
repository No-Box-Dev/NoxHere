import AppKit
import SwiftUI

private enum SettingsSection: String, CaseIterable, Identifiable {
    case workspace
    case repositories
    case people
    case narration
    case delivery
    case notifications
    case maintenance

    var id: Self { self }

    var title: String {
        switch self {
        case .workspace: "Workspace"
        case .repositories: "Repositories"
        case .people: "People"
        case .narration: "Narration"
        case .delivery: "Delivery"
        case .notifications: "Notifications"
        case .maintenance: "Maintenance"
        }
    }

    var icon: String {
        switch self {
        case .workspace: "building.2"
        case .repositories: "shippingbox"
        case .people: "person.2"
        case .narration: "sparkles"
        case .delivery: "paperplane"
        case .notifications: "bell"
        case .maintenance: "wrench.and.screwdriver"
        }
    }

    var adminOnly: Bool {
        switch self {
        case .workspace, .notifications: false
        default: true
        }
    }
}

struct SettingsWindow: View {
    @EnvironmentObject private var state: AppState
    @EnvironmentObject private var notifier: NotifierStore
    @State private var selection: SettingsSection? = .workspace

    var body: some View {
        NavigationSplitView {
            List(SettingsSection.allCases, selection: $selection) { section in
                Label(section.title, systemImage: section.icon)
                    .accessibilityIdentifier("settings-sidebar-\(section.rawValue)")
                    .tag(section)
            }
            .scrollDisabled(true)
            .navigationTitle("NoxHere")
            .navigationSplitViewColumnWidth(min: 180, ideal: 205, max: 240)
        } detail: {
            detail(for: selection ?? .workspace)
                .accessibilityIdentifier("settings-page-\(selection?.rawValue ?? "workspace")")
                .id("\(selection?.rawValue ?? "workspace")-\(state.activeLogin ?? "none")-\(state.activeOrg ?? "none")")
        }
        .frame(minWidth: 760, minHeight: 540)
        .background(UT.surface)
        .onAppear {
            // LSUIElement apps do not automatically come to the foreground
            // when a regular window is opened from a menu-bar popover.
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }

    @ViewBuilder
    private func detail(for section: SettingsSection) -> some View {
        if section.adminOnly && !state.isAdmin {
            SettingsAccessRequired(section: section)
        } else {
            switch section {
            case .workspace:
                WorkspaceSettingsPage()
            case .repositories:
                RepositoriesSettingsPage()
            case .people:
                ManagePeopleSheet(showsHeader: false)
                    .disabled(state.isDemoMode)
                    .safeAreaInset(edge: .top) { DemoReadOnlyBanner() }
            case .narration:
                NarrationSettingsPage()
            case .delivery:
                DeliverySettingsPage()
            case .notifications:
                NotificationSettingsPane(
                    settings: notifier.settings,
                    onTest: { Task { await notifier.sendTestNotification() } }
                )
            case .maintenance:
                MaintenanceSettingsPage()
            }
        }
    }
}

private struct SettingsAccessRequired: View {
    let section: SettingsSection

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.system(size: 28))
                .foregroundStyle(UT.textTertiary)
            Text("Administrator access required")
                .font(.headline)
                .foregroundStyle(UT.textPrimary)
            Text("You can view NoxHere, but only an organization administrator can change \(section.title.lowercased()) settings.")
                .font(.subheadline)
                .foregroundStyle(UT.textMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 390)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(UT.surface)
    }
}

private struct DemoReadOnlyBanner: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        if state.isDemoMode {
            Label("Demo workspace is read-only", systemImage: "lock.fill")
                .font(.caption)
                .foregroundStyle(UT.warnText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(UT.warnBg)
        }
    }
}

struct SettingsPage<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(UT.textPrimary)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(UT.textMuted)
                }
                content
            }
            .padding(24)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .background(UT.surface)
    }
}

struct SettingsCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 12)
    }
}

private struct WorkspaceSettingsPage: View {
    @EnvironmentObject private var state: AppState
    @State private var overview: APIClient.IntegrationOverview?
    @State private var connectConfig: APIClient.NoxConnectServiceConfigEnvelope?
    @State private var loading = true
    @State private var savingService = false
    @State private var overviewError: String?
    @State private var configError: String?

    var body: some View {
        SettingsPage(
            title: "Workspace",
            subtitle: "The GitHub account and NoxConnect workspace used by this device."
        ) {
            SettingsCard(
                title: "Current workspace",
                icon: state.activeWorkspaceIsPersonal ? "person.crop.circle.fill" : "building.2.fill"
            ) {
                LabeledContent("GitHub account", value: state.activeLogin.map { "@\($0)" } ?? "Not signed in")
                LabeledContent(
                    state.activeWorkspaceIsPersonal ? "Personal account" : "Organization",
                    value: state.activeWorkspaceIsPersonal
                        ? state.activeLogin.map { "@\($0)" } ?? "Not selected"
                        : state.activeOrg ?? "Not selected"
                )
                LabeledContent("Access", value: state.isAdmin ? "Administrator" : "Member")
                Button("Refresh workspace") { Task { await refresh() } }
                    .controlSize(.small)
            }

            SettingsCard(title: "NoxConnect", icon: "link.circle.fill") {
                if loading {
                    ProgressView().controlSize(.small)
                } else if let overviewError {
                    Text(overviewError).foregroundStyle(.red).font(.caption)
                    Button("Retry") { Task { await load() } }.controlSize(.small)
                } else if let overview {
                    StatusLine(
                        title: overview.setup.ready ? "Connected" : "Needs attention",
                        detail: githubDetail(overview),
                        healthy: overview.setup.ready
                    )
                    if let raw = overview.github.connected ? overview.github.manageUrl : overview.github.installUrl,
                       let url = URL(string: raw) {
                        Button(overview.github.connected ? "Manage GitHub access…" : "Install NoxConnect…") {
                            NSWorkspace.shared.open(url)
                        }
                        .controlSize(.small)
                        .disabled(state.isDemoMode)
                    }
                }
            }

            if state.isAdmin {
                SettingsCard(title: "Activity service", icon: "list.bullet.rectangle.portrait.fill") {
                    if let configError {
                        Label(configError, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(UT.textMuted)
                        Button("Retry management connection") { Task { await loadConfig() } }
                            .controlSize(.small)
                    } else {
                        Toggle(
                            "Enable Activity for this organization",
                            isOn: Binding(
                                get: { connectConfig?.config.enabledServices.noxfeed ?? true },
                                set: { enabled in Task { await setNoxFeedEnabled(enabled) } }
                            )
                        )
                        .disabled(connectConfig == nil || savingService || state.isDemoMode)
                        Text("Turning Activity off retains existing data and settings, but stops feed and narration capabilities.")
                            .font(.caption)
                            .foregroundStyle(UT.textMuted)
                    }
                }
            }
        }
        .task { await load() }
    }

    private func githubDetail(_ overview: APIClient.IntegrationOverview) -> String {
        if overview.github.bootstrapping { return "Initial repository sync is running." }
        if !overview.github.connected { return "The GitHub App is not connected to this organization." }
        return overview.github.health == "ok" ? "GitHub events and repository data are available." : "GitHub connection health: \(overview.github.health)."
    }

    private func refresh() async {
        await state.refreshOrganizations()
        await load()
    }

    private func load() async {
        guard state.activeOrg != nil else { loading = false; return }
        loading = true
        defer { loading = false }
        do {
            overview = try await state.makeAPIClient().fetchIntegrationOverview()
            overviewError = nil
        } catch {
            overview = nil
            overviewError = error.userFacingDescription
        }
        if state.isAdmin {
            await loadConfig()
        }
    }

    private func loadConfig() async {
        do {
            connectConfig = try await state.makeAPIClient().fetchNoxConnectServiceConfig()
            configError = nil
        } catch {
            connectConfig = nil
            configError = error.userFacingDescription
        }
    }

    private func setNoxFeedEnabled(_ enabled: Bool) async {
        guard let connectConfig else { return }
        savingService = true
        defer { savingService = false }
        do {
            self.connectConfig = try await state.makeAPIClient().patchNoxConnectServiceConfig(
                revision: connectConfig.revision,
                fields: ["enabledServices": .object(["noxfeed": .bool(enabled)])]
            )
        } catch {
            configError = error.userFacingDescription
            await loadConfig()
        }
    }
}

private struct RepositoriesSettingsPage: View {
    @EnvironmentObject private var state: AppState
    @State private var connectConfig: APIClient.NoxConnectServiceConfigEnvelope?
    @State private var savingPolicy = false
    @State private var message: String?

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Repositories")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(UT.textPrimary)
                    Text("Choose what NoxConnect tracks and how newly discovered repositories are handled.")
                        .font(.system(size: 12))
                        .foregroundStyle(UT.textMuted)
                }
                SettingsCard(title: "New repositories", icon: "sparkles.rectangle.stack") {
                    Picker(
                        "When a repository is discovered",
                        selection: Binding(
                            get: { connectConfig?.config.newRepositoryPolicy ?? "include" },
                            set: { value in Task { await setPolicy(value) } }
                        )
                    ) {
                        Text("Track automatically").tag("include")
                        Text("Hold for review").tag("exclude")
                    }
                    .pickerStyle(.radioGroup)
                    .disabled(connectConfig == nil || savingPolicy || state.isDemoMode)
                    if let message { Text(message).font(.caption).foregroundStyle(UT.textMuted) }
                }
            }
            .padding(24)
            .padding(.bottom, 4)
            Divider().overlay(UT.border)
            ManageReposSheet(showsHeader: false)
                .disabled(state.isDemoMode)
        }
        .background(UT.surface)
        .safeAreaInset(edge: .top) { DemoReadOnlyBanner() }
        .task { await load() }
    }

    private func load() async {
        do {
            connectConfig = try await state.makeAPIClient().fetchNoxConnectServiceConfig()
            message = nil
        } catch {
            message = error.userFacingDescription
        }
    }

    private func setPolicy(_ policy: String) async {
        guard let connectConfig else { return }
        savingPolicy = true
        defer { savingPolicy = false }
        do {
            self.connectConfig = try await state.makeAPIClient().patchNoxConnectServiceConfig(
                revision: connectConfig.revision,
                fields: ["newRepositoryPolicy": .string(policy)]
            )
            message = "Saved"
        } catch {
            message = error.userFacingDescription
            await load()
        }
    }
}

private struct NarrationSettingsPage: View {
    @EnvironmentObject private var state: AppState
    @State private var ai: APIClient.ManagedAISettings?
    @State private var config: APIClient.NoxFeedServiceConfigEnvelope?
    @State private var builtInPrompt = ""
    @State private var prompt = ""
    @State private var saving = false
    @State private var message: String?

    var body: some View {
        SettingsPage(
            title: "Narration",
            subtitle: "NoxHere uses its built-in managed AI. Provider credentials never enter the app."
        ) {
            SettingsCard(title: "Built-in AI", icon: "sparkles") {
                if let ai {
                    StatusLine(
                        title: ai.managed.available && ai.mode != "disabled" ? "Available" : "Unavailable",
                        detail: ai.managed.available ? "Managed by NoxConnect" : "The managed service is not configured.",
                        healthy: ai.managed.available && ai.mode != "disabled"
                    )
                } else {
                    ProgressView().controlSize(.small)
                }
                Text("AI requests are handled by NoxConnect; no provider credentials are stored on this Mac.")
                    .font(.caption)
                    .foregroundStyle(UT.textMuted)
            }

            SettingsCard(title: "Release-notes prompt", icon: "text.quote") {
                Text("NoxHere provides the release-note structure, accuracy rules, and GitHub context. Describe your audience, tone, terminology, level of detail, and anything to include or avoid.")
                    .font(.caption)
                    .foregroundStyle(UT.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                if config?.config.releaseNotesPrompt == nil, !builtInPrompt.isEmpty {
                    Label("Using the built-in Activity prompt", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(UT.textMuted)
                }
                TextEditor(text: $prompt)
                    .font(.system(size: 12, design: .monospaced))
                    .frame(minHeight: 220)
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(UT.surface))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(UT.border))
                    .disabled(saving || config == nil || state.isDemoMode)
                HStack {
                    Button("Save prompt") { Task { await savePrompt() } }
                        .buttonStyle(.borderedProminent)
                        .tint(UT.accent)
                        .disabled(saving || config == nil || prompt == savedPrompt || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || state.isDemoMode)
                    Button("Use built-in prompt") { Task { await resetPrompt() } }
                        .disabled(saving || config?.config.releaseNotesPrompt == nil || state.isDemoMode)
                    if let message {
                        Text(message).font(.caption).foregroundStyle(UT.textMuted)
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        async let loadedAI = try? state.makeAPIClient().fetchManagedAISettings()
        async let loadedConfig = try? state.makeAPIClient().fetchNoxFeedServiceConfig()
        async let loadedDefault = try? state.makeAPIClient().fetchReleaseNotesPromptDefault()
        let (newAI, newConfig, newDefault) = await (loadedAI, loadedConfig, loadedDefault)
        ai = newAI
        config = newConfig
        builtInPrompt = newDefault?.prompt ?? ""
        prompt = newConfig?.config.releaseNotesPrompt ?? builtInPrompt
        if newDefault == nil {
            message = "The built-in prompt could not be loaded. Retry before editing."
        } else if newConfig == nil {
            message = APIError.capabilityUnavailable.errorDescription
        } else {
            message = nil
        }
    }

    private var savedPrompt: String {
        config?.config.releaseNotesPrompt ?? builtInPrompt
    }

    private func savePrompt() async {
        guard let config else { return }
        saving = true
        defer { saving = false }
        do {
            let updated = try await state.makeAPIClient().patchNoxFeedServiceConfig(
                revision: config.revision,
                fields: ["releaseNotesPrompt": .string(prompt)]
            )
            self.config = updated
            message = "Saved"
        } catch {
            message = error.userFacingDescription
            await load()
        }
    }

    private func resetPrompt() async {
        guard let config else { return }
        saving = true
        defer { saving = false }
        do {
            let updated = try await state.makeAPIClient().patchNoxFeedServiceConfig(
                revision: config.revision,
                fields: ["releaseNotesPrompt": .null]
            )
            self.config = updated
            prompt = builtInPrompt
            message = "Using built-in prompt"
        } catch {
            message = error.userFacingDescription
            await load()
        }
    }
}

private struct DeliverySettingsPage: View {
    @EnvironmentObject private var state: AppState
    @State private var status: APIClient.SlackStatus?
    @State private var routes: APIClient.SlackRoutes?
    @State private var posts = SlackRouteDraft()
    @State private var releaseNotes = SlackRouteDraft()
    @State private var channelsByConnection: [String: [APIClient.SlackChannel]] = [:]
    @State private var loadingConnections = Set<String>()
    @State private var savingRoutes = Set<String>()
    @State private var testingRoutes = Set<String>()
    @State private var routeMessages: [String: String] = [:]
    @State private var errorMessage: String?

    var body: some View {
        SettingsPage(
            title: "Delivery",
            subtitle: "The same NoxConnect project and Slack routes shown in its web admin."
        ) {
            SettingsCard(title: "Slack connection", icon: "message.fill") {
                if let status, status.connected {
                    ForEach(status.connections) { connection in
                        StatusLine(
                            title: connection.teamName + (connection.isDefault ? " · default" : ""),
                            detail: connection.needsReconnect ? "Reconnect required." : "Connection health: \(connection.health).",
                            healthy: !connection.needsReconnect && connection.health == "ok"
                        )
                    }
                } else {
                    Text(status == nil ? "Loading Slack connection…" : "Connect Slack in NoxConnect before choosing channels.")
                        .font(.caption)
                        .foregroundStyle(UT.textMuted)
                }
            }

            SettingsCard(title: "Posts", icon: "text.bubble") {
                Text("Narrated pull request activity.").font(.caption).foregroundStyle(UT.textMuted)
                routeEditor(name: "noxfeed_posts", draft: $posts)
            }

            SettingsCard(title: "Release notes", icon: "doc.text") {
                Text("Summaries generated from merged work.").font(.caption).foregroundStyle(UT.textMuted)
                routeEditor(name: "noxfeed_release_notes", draft: $releaseNotes)
            }

            if let errorMessage {
                Text(errorMessage).font(.caption).foregroundStyle(.red)
            }
        }
        .task { await load() }
    }

    private func load() async {
        async let loadedStatus = try? state.makeAPIClient().fetchSlackStatus()
        async let loadedRoutes = try? state.makeAPIClient().fetchSlackRoutes()
        let (newStatus, newRoutes) = await (loadedStatus, loadedRoutes)
        status = newStatus
        routes = newRoutes

        let defaultConnection = newStatus?.defaultConnectionId ?? ""
        posts = SlackRouteDraft(
            channelId: newRoutes.flatMap { $0.routes["noxfeed_posts"] ?? nil } ?? "",
            connectionId: newRoutes?.connections.flatMap { $0["noxfeed_posts"] ?? nil } ?? defaultConnection
        )
        releaseNotes = SlackRouteDraft(
            channelId: newRoutes.flatMap { $0.routes["noxfeed_release_notes"] ?? nil } ?? "",
            connectionId: newRoutes?.connections.flatMap { $0["noxfeed_release_notes"] ?? nil } ?? defaultConnection
        )
        await loadChannels(for: posts.connectionId)
        if releaseNotes.connectionId != posts.connectionId {
            await loadChannels(for: releaseNotes.connectionId)
        }
    }

    @ViewBuilder
    private func routeEditor(name: String, draft: Binding<SlackRouteDraft>) -> some View {
        let connectionId = draft.wrappedValue.connectionId
        let availableChannels = channelsByConnection[connectionId] ?? []

        if let status, status.connections.count > 1 {
            Picker("Slack workspace", selection: draft.connectionId) {
                ForEach(status.connections) { connection in
                    Text(connection.teamName + (connection.isDefault ? " · default" : "")).tag(connection.id)
                }
            }
            .onChange(of: draft.wrappedValue.connectionId) { _, newConnection in
                draft.wrappedValue.channelId = ""
                Task { await loadChannels(for: newConnection) }
            }
        }

        if loadingConnections.contains(connectionId) {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Loading channels…").font(.caption).foregroundStyle(UT.textMuted)
            }
        } else {
            Picker("Channel", selection: draft.channelId) {
                Text("Organization fallback").tag("")
                if !draft.wrappedValue.channelId.isEmpty,
                   !availableChannels.contains(where: { $0.id == draft.wrappedValue.channelId }) {
                    Text("Previously selected channel (unavailable)").tag(draft.wrappedValue.channelId)
                }
                ForEach(availableChannels) { channel in
                    Text("\(channel.isPrivate ? "🔒 " : "#")\(channel.name)").tag(channel.id)
                }
            }
        }

        HStack(spacing: 8) {
            if let channelStatus = status?.channelStatuses.first(where: {
                $0.connectionId == connectionId && $0.channelId == draft.wrappedValue.channelId
            }), !draft.wrappedValue.channelId.isEmpty {
                Label(
                    channelStatus.status == "verified" ? "Verified" : channelStatus.status == "issue" ? "Issue" : "Not tested",
                    systemImage: channelStatus.status == "verified" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                )
                .font(.caption)
                .foregroundStyle(channelStatus.status == "verified" ? .green : .orange)
                .help(channelStatus.lastError ?? "")
            }
            Button("Save") { Task { await saveRoute(name: name, draft: draft.wrappedValue) } }
                .buttonStyle(.borderedProminent)
                .tint(UT.accent)
                .disabled(savingRoutes.contains(name) || loadingConnections.contains(connectionId) || status?.connected != true || state.isDemoMode)
            Button("Test") { Task { await testRoute(name: name, draft: draft.wrappedValue) } }
                .disabled(testingRoutes.contains(name) || draft.wrappedValue.channelId.isEmpty || state.isDemoMode)
            if savingRoutes.contains(name) || testingRoutes.contains(name) {
                ProgressView().controlSize(.small)
            }
            if let message = routeMessages[name] {
                Text(message).font(.caption).foregroundStyle(UT.textMuted)
            }
        }
    }

    private func loadChannels(for connectionId: String) async {
        guard !connectionId.isEmpty, channelsByConnection[connectionId] == nil else { return }
        loadingConnections.insert(connectionId)
        defer { loadingConnections.remove(connectionId) }
        do {
            channelsByConnection[connectionId] = try await state.makeAPIClient().fetchSlackChannels(connectionId: connectionId).channels
                .filter { !$0.isArchived }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        } catch {
            errorMessage = error.userFacingDescription
        }
    }

    private func saveRoute(name: String, draft: SlackRouteDraft) async {
        savingRoutes.insert(name)
        defer { savingRoutes.remove(name) }
        do {
            routes = try await state.makeAPIClient().patchSlackRoute(
                name: name,
                channelId: draft.channelId.isEmpty ? nil : draft.channelId,
                connectionId: draft.channelId.isEmpty || draft.connectionId.isEmpty ? nil : draft.connectionId
            )
            routeMessages[name] = draft.channelId.isEmpty ? "Using organization fallback" : "Saved"
            status = try? await state.makeAPIClient().fetchSlackStatus()
        } catch {
            routeMessages[name] = error.userFacingDescription
        }
    }

    private func testRoute(name: String, draft: SlackRouteDraft) async {
        guard !draft.channelId.isEmpty, !draft.connectionId.isEmpty else { return }
        testingRoutes.insert(name)
        defer { testingRoutes.remove(name) }
        do {
            try await state.makeAPIClient().testSlackRoute(
                name: name,
                channelId: draft.channelId,
                connectionId: draft.connectionId
            )
            routeMessages[name] = "Test delivered"
            status = try? await state.makeAPIClient().fetchSlackStatus()
        } catch {
            routeMessages[name] = error.userFacingDescription
        }
    }
}

private struct SlackRouteDraft: Equatable {
    var channelId = ""
    var connectionId = ""
}

private struct HistoryBackfillCard: View {
    @EnvironmentObject private var state: AppState
    @State private var projects: [FeedProject] = []
    @State private var days = 3
    @State private var rewriteOtherModels = false
    @State private var running = false
    @State private var progress = ""
    @State private var resultMessage: String?
    @State private var errors: [String] = []

    private var activeProjects: [FeedProject] {
        projects.filter(\.isTrackedRepository)
    }

    var body: some View {
        SettingsCard(title: "Posts history", icon: "clock.arrow.circlepath") {
            Text("Generate first-person posts for recently merged PRs across every active repository. Existing backfilled PRs are skipped.")
                .font(.caption)
                .foregroundStyle(UT.textMuted)
            Stepper("Days: \(days)", value: $days, in: 1...30)
                .frame(maxWidth: 180, alignment: .leading)
                .disabled(running)
            Toggle("Rewrite posts written on a different model", isOn: $rewriteOtherModels)
                .toggleStyle(.checkbox)
                .disabled(running)
            HStack {
                Button(running ? "Backfilling \(progress)" : "Backfill all \(activeProjects.count) active repos") {
                    Task { await backfillAll() }
                }
                .buttonStyle(.borderedProminent)
                .tint(UT.accent)
                .disabled(running || activeProjects.isEmpty || state.isDemoMode)
                if running { ProgressView().controlSize(.small) }
            }
            if let resultMessage {
                Text(resultMessage).font(.caption).foregroundStyle(.green)
            }
            ForEach(errors, id: \.self) { error in
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
        .task {
            projects = (try? await state.makeAPIClient().fetchProjects()) ?? []
        }
    }

    private func backfillAll() async {
        let targets = activeProjects
        running = true
        errors = []
        resultMessage = nil
        defer { running = false; progress = "" }
        var found = 0
        var queued = 0
        var renarrated = 0
        for (index, project) in targets.enumerated() {
            progress = "\(project.repositoryDisplayName) (\(index)/\(targets.count))"
            do {
                let result = try await state.makeAPIClient().backfillProjectPRs(
                    id: project.id,
                    days: days,
                    rewriteOtherModels: rewriteOtherModels
                )
                found += result.found
                queued += result.queued
                renarrated += result.renarrated
            } catch {
                errors.append("\(project.repositoryDisplayName): \(error.userFacingDescription)")
            }
        }
        resultMessage = "Queued \(queued) new posts from \(found) PRs found\(renarrated > 0 ? ", re-narrated \(renarrated) posts" : "")."
    }
}

private struct MaintenanceSettingsPage: View {
    @EnvironmentObject private var state: AppState
    @State private var syncing = false
    @State private var message: String?
    @State private var confirmFullSync = false

    var body: some View {
        SettingsPage(
            title: "Maintenance",
            subtitle: "Repair missing activity or refresh repository data through NoxConnect."
        ) {
            HistoryBackfillCard()
            SettingsCard(title: "Repository synchronization", icon: "arrow.triangle.2.circlepath") {
                Text("Incremental sync fetches recent changes. A full re-sync rechecks all tracked repository history and can take several minutes.")
                    .font(.caption)
                    .foregroundStyle(UT.textMuted)
                HStack {
                    Button("Run incremental sync") { Task { await sync(force: false) } }
                        .disabled(syncing || state.isDemoMode)
                    Button("Force full re-sync…") { confirmFullSync = true }
                        .disabled(syncing || state.isDemoMode)
                    if syncing { ProgressView().controlSize(.small) }
                }
                if let message { Text(message).font(.caption).foregroundStyle(UT.textMuted) }
            }
        }
        .confirmationDialog(
            "Force a full re-sync?",
            isPresented: $confirmFullSync,
            titleVisibility: .visible
        ) {
            Button("Force full re-sync") { Task { await sync(force: true) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This can make many GitHub requests. Existing Activity data is retained while synchronization runs.")
        }
    }

    private func sync(force: Bool) async {
        syncing = true
        defer { syncing = false }
        do {
            try await state.makeAPIClient().triggerSync(force: force)
            message = force ? "Full re-sync started." : "Incremental sync started."
        } catch {
            message = error.userFacingDescription
        }
    }
}

private struct StatusLine: View {
    let title: String
    let detail: String
    let healthy: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: healthy ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(healthy ? .green : .orange)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(UT.textPrimary)
                Text(detail).font(.caption).foregroundStyle(UT.textMuted)
            }
        }
    }
}
