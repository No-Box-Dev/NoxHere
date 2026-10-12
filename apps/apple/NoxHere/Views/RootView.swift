import SwiftUI

struct RootView: View {
    @EnvironmentObject private var state: AppState
    @State private var completionRevision = 0
    @State private var demoSetupComplete = false
    @State private var welcomePreviewCompleted = false

    var body: some View {
        Group {
            #if DEBUG
            if OnboardingFlow.forcesWelcomePreview(
                arguments: ProcessInfo.processInfo.arguments,
                previewWasCompleted: welcomePreviewCompleted
            ) {
                OnboardingView(onDone: {
                    welcomePreviewCompleted = true
                })
            } else {
                routedContent
            }
            #else
            routedContent
            #endif
        }
        .foregroundStyle(UT.textBody)
        .tint(UT.accent)
        .background(UT.surface)
        .onChange(of: state.isDemoMode) { _, isDemo in
            if !isDemo { demoSetupComplete = false }
        }
    }

    @ViewBuilder
    private var routedContent: some View {
        Group {
            switch route {
            case .welcome:
                OnboardingView()
            case .loadingOrganizations:
                OrganizationLoadingState()
            case .noOrganizations:
                NoOrganizationState()
            case .connectOrganization:
                ConnectOrganizationState()
            case .setupComplete:
                SetupCompleteState {
                    completeSetup()
                }
            case .feed:
                if let pr = state.prTarget {
                    PRDetailView(pr: pr, onBack: { state.prTarget = nil })
                        .environmentObject(state)
                } else {
                    FeedView()
                }
            }
        }
    }

    private var route: OnboardingRoute {
        _ = completionRevision
        return OnboardingFlow.route(for: OnboardingSnapshot(
            isSignedIn: state.phase == .ready,
            organizationStatusLoaded: state.activeOrganizationStatusIsLoaded,
            hasOrganization: state.activeOrg != nil,
            organizationConnected: state.activeOrgIsConnected,
            setupWasCompleted: setupWasCompleted
        ))
    }

    private var setupWasCompleted: Bool {
        if state.isDemoMode { return demoSetupComplete }
        guard let login = state.activeLogin, let organization = state.activeOrg else { return false }
        return OnboardingCompletionStore.isComplete(login: login, organization: organization)
    }

    private func completeSetup() {
        if state.isDemoMode {
            demoSetupComplete = true
        } else if let login = state.activeLogin, let organization = state.activeOrg {
            OnboardingCompletionStore.markComplete(login: login, organization: organization)
            completionRevision += 1
        }
    }
}

struct OrganizationLoadingState: View {
    @EnvironmentObject private var state: AppState
    @State private var retrying = false

    var body: some View {
        SetupPage(
            step: 2,
            title: "Choose a workspace",
            icon: state.lastError == nil ? "building.2.crop.circle" : "wifi.exclamationmark",
            headline: state.lastError == nil ? "Finding your workspaces" : "We could not load your workspaces",
            message: state.lastError == nil
                ? "NoxHere is checking which GitHub organizations and personal account you can use."
                : state.lastError ?? "Please try once more."
        ) {
            VStack(spacing: 14) {
                if state.lastError == nil || retrying {
                    ProgressView().controlSize(.regular).tint(UT.accent)
                    Text("This should take only a few seconds.")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                } else {
                    SetupPrimaryButton(title: "Try again", loading: retrying) {
                        retrying = true
                        Task {
                            await state.refreshOrganizations()
                            retrying = false
                        }
                    }
                    Button("Sign out and start again") { state.signOutActive() }
                        .buttonStyle(.plain)
                        .foregroundStyle(UT.textMuted)
                        .font(.system(size: 11))
                }
            }
        }
    }
}

struct NoOrganizationState: View {
    @EnvironmentObject private var state: AppState
    @State private var checking = false
    @State private var localError: String?

    var body: some View {
        SetupPage(
            step: 2,
            title: "Choose a workspace",
            icon: "building.2",
            headline: "Choose a GitHub workspace",
            message: OnboardingCopy.noOrganization
        ) {
            VStack(spacing: 14) {
                SetupTip(
                    icon: "person.crop.circle",
                    title: "Personal repositories",
                    text: "Use your personal GitHub account to track repositories you own."
                )
                SetupTip(
                    icon: "person.2",
                    title: "Organization repositories",
                    text: "Join or create a GitHub organization, then refresh this list."
                )

                if let login = state.activeLogin {
                    SetupPrimaryButton(title: "Use personal account", loading: false) {
                        state.selectOrg(login)
                    }
                } else {
                    SetupPrimaryButton(
                        title: checking ? "Checking GitHub…" : "Open GitHub organizations",
                        loading: checking
                    ) {
                        openOrganizations()
                    }
                }

                Button("Check again") {
                    Task { await checkAgain() }
                }
                .buttonStyle(.plain)
                .foregroundStyle(UT.accent)
                .font(.system(size: 11, weight: .medium))
                .disabled(checking)

                if let localError {
                    Text(localError)
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                Button("Use a different GitHub account") { state.signOutActive() }
                    .buttonStyle(.plain)
                    .foregroundStyle(UT.textMuted)
                    .font(.system(size: 11))
            }
        }
    }

    private func openOrganizations() {
        localError = nil
        do {
            try AuthService.shared.beginWebAuthentication(at: Config.githubOrganizationsURL)
            checking = true
            Task { await pollForOrganization() }
        } catch {
            localError = "GitHub could not open. Please try again."
        }
    }

    private func checkAgain() async {
        checking = true
        localError = nil
        await state.refreshOrganizations()
        checking = false
        if state.activeOrg == nil {
            localError = "No organization was found yet. You may still need to accept the GitHub invite."
        }
    }

    private func pollForOrganization() async {
        for _ in 0..<40 {
            guard !Task.isCancelled else { return }
            try? await Task.sleep(for: .seconds(3))
            await state.refreshOrganizations()
            if state.activeOrg != nil {
                AuthService.shared.endWebAuthentication()
                checking = false
                return
            }
        }
        checking = false
        localError = "We did not find a team yet. Finish on GitHub, then press Check again."
    }
}

struct ConnectOrganizationState: View {
    @EnvironmentObject private var state: AppState
    @State private var checking = false
    @State private var localError: String?

    var body: some View {
        SetupPage(
            step: 2,
            title: "Connect your workspace",
            icon: state.activeWorkspaceIsPersonal ? "person.crop.circle.badge.plus" : "link.badge.plus",
            headline: state.activeWorkspaceIsPersonal
                ? "Connect your personal account"
                : "Connect \(state.activeOrg ?? "your team")",
            message: state.activeWorkspaceIsPersonal
                ? "Install NoxHere on your personal GitHub account and choose the repositories NoxHere may track."
                : OnboardingCopy.install
        ) {
            VStack(spacing: 14) {
                if state.activeWorkspaces.count > 1 {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("GitHub workspace")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(UT.textMuted)
                        Menu(state.activeWorkspace?.displayName ?? "Choose a workspace") {
                            ForEach(state.activeWorkspaces) { workspace in
                                Button(workspace.displayName) { state.selectOrg(workspace.login) }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(12)
                    .cardStyle(cornerRadius: 9)
                }

                SetupTip(
                    icon: "app.badge.checkmark",
                    title: "What is NoxHere?",
                    text: OnboardingCopy.connectionNote
                )
                SetupTip(
                    icon: "checklist",
                    title: "You pick the repos",
                    text: state.activeWorkspaceIsPersonal
                        ? "GitHub lets you allow all personal repos or only the ones you want NoxHere to track."
                        : "GitHub lets you allow all repos or choose only the ones your team needs."
                )

                SetupPrimaryButton(
                    title: checking ? "Waiting for GitHub…" : "Install NoxHere on GitHub",
                    loading: checking
                ) {
                    startInstall()
                }

                if checking {
                    Text("Finish the install in GitHub. NoxHere will check the link for you.")
                        .font(.system(size: 10))
                        .foregroundStyle(UT.textMuted)
                        .multilineTextAlignment(.center)
                }

                Button("Check connection now") {
                    Task { await checkNow(showError: true) }
                }
                .buttonStyle(.plain)
                .foregroundStyle(UT.accent)
                .font(.system(size: 11, weight: .medium))
                .disabled(checking)

                if let localError {
                    Label(localError, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }

    private func startInstall() {
        localError = nil
        do {
            try AuthService.shared.beginWebAuthentication(at: Config.githubAppInstallURL)
            checking = true
            Task { await pollForConnection() }
        } catch {
            localError = "GitHub could not open. Please try again."
        }
    }

    private func pollForConnection() async {
        for _ in 0..<40 {
            guard !Task.isCancelled else { return }
            try? await Task.sleep(for: .seconds(3))
            await state.refreshOrganizations()
            if state.activeOrgIsConnected {
                AuthService.shared.endWebAuthentication()
                checking = false
                return
            }
        }
        checking = false
        localError = "The link is not ready yet. Finish on GitHub, then check the connection."
    }

    private func checkNow(showError: Bool) async {
        checking = true
        localError = nil
        await state.refreshOrganizations()
        checking = false
        if showError && !state.activeOrgIsConnected {
            localError = state.lastError ?? "NoxHere is not installed for this organization yet."
        }
    }
}

struct SetupCompleteState: View {
    @EnvironmentObject private var state: AppState
    let onContinue: () -> Void

    var body: some View {
        SetupPage(
            step: 3,
            title: "Start your feed",
            icon: "checkmark.circle.fill",
            headline: state.isDemoMode ? "Your demo is ready" : "\(state.activeOrg ?? "Your team") is connected",
            message: state.isDemoMode
                ? "You can now explore a full, read-only NoxHere workspace."
                : OnboardingCopy.ready
        ) {
            VStack(spacing: 14) {
                VStack(spacing: 8) {
                    tabTip(icon: "scope", title: "Current", text: "Work that may need care now")
                    tabTip(icon: "arrow.up.right.circle", title: "Opened", text: "Pull requests your team opened")
                    tabTip(icon: "checkmark.circle", title: "Merged", text: "Changes that reached the main branch")
                    tabTip(icon: "note.text", title: "Notes", text: "Clear notes for recent releases")
                }

                Text(OnboardingCopy.tabs)
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textMuted)
                    .multilineTextAlignment(.center)

                SetupPrimaryButton(title: state.isDemoMode ? "Open the demo feed" : "Open my feed") {
                    onContinue()
                }

                Label("NoxHere stays in the menu bar. Use ⇧⌘X to open it.", systemImage: "keyboard")
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textTertiary)
            }
        }
    }

    private func tabTip(icon: String, title: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(UT.accent)
                .frame(width: 22)
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
                .frame(width: 58, alignment: .leading)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(UT.textMuted)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .cardStyle(cornerRadius: 9)
    }
}
