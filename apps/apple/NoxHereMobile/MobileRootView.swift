import SwiftUI
import UIKit

struct MobileRootView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.scenePhase) private var scenePhase
    @State private var didStartDemoFromLaunchArgument = false

    var body: some View {
        Group {
            if state.phase == .signedOut {
                MobileSignInView()
            } else if state.activeOrg == nil {
                MobileOrganizationPicker()
            } else if state.activeOrganizationStatusIsLoaded && !state.activeOrgIsConnected {
                MobileConnectionRequiredView()
            } else {
                MobileTabs()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: state.phase == .ready)
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, state.phase == .ready else { return }
            Task { await state.refreshOrganizations() }
        }
        .task {
            guard !didStartDemoFromLaunchArgument,
                  ProcessInfo.processInfo.arguments.contains("--start-demo"),
                  state.phase == .signedOut else { return }
            didStartDemoFromLaunchArgument = true
            try? await state.enterDemo()
        }
    }
}

private struct MobileConnectionRequiredView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label(
                    state.activeWorkspaceIsPersonal
                        ? "Connect your personal account"
                        : "Connect \(state.activeOrg ?? "organization")",
                    systemImage: state.activeWorkspaceIsPersonal
                        ? "person.crop.circle.badge.plus"
                        : "link.badge.plus"
                )
            } description: {
                Text(
                    state.activeWorkspaceIsPersonal
                        ? "Install NoxHere for your personal GitHub account and choose which repositories NoxHere may track."
                        : "Install NoxHere for this GitHub organization to make its activity available in NoxHere."
                )
            } actions: {
                Button("Install NoxHere") { openURL(Config.githubAppInstallURL) }
                    .buttonStyle(.borderedProminent)
                Button("Check again") { Task { await state.refreshOrganizations() } }
            }
            .navigationTitle("NoxHere")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Change workspace") { state.selectOrg(nil) }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign out", role: .destructive) { state.signOutActive() }
                }
            }
        }
    }
}

private struct MobileTabs: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        TabView {
            NavigationStack { MobileFeedView() }
                .tabItem { Label("Feed", systemImage: "rectangle.stack") }

            NavigationStack { MobileCurrentView() }
                .tabItem { Label("Current", systemImage: "person.crop.circle") }

            NavigationStack { MobileAccountView() }
                .tabItem { Label("Account", systemImage: "gearshape") }
        }
    }
}

@MainActor
private final class MobileSignInModel: ObservableObject {
    @Published var device: AuthService.DeviceInit?
    @Published var isLoading = false
    @Published var errorMessage: String?
    private var pollTask: Task<Void, Never>?

    func start() {
        pollTask?.cancel()
        AuthService.shared.endWebAuthentication()
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let device = try await AuthService.shared.startDeviceFlow()
                self.device = device
                UIPasteboard.general.string = device.userCode
                openGitHub(for: device)
                pollTask = Task {
                    do {
                        try await AuthService.shared.pollForAccessToken(device)
                        AuthService.shared.endWebAuthentication()
                    } catch is CancellationError {
                        return
                    } catch {
                        AuthService.shared.endWebAuthentication()
                        self.errorMessage = error.localizedDescription
                    }
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    func openGitHub(for device: AuthService.DeviceInit) {
        UIPasteboard.general.string = device.userCode
        errorMessage = nil
        do {
            try AuthService.shared.beginWebAuthentication(at: device.verificationUri)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cancel() {
        pollTask?.cancel()
        pollTask = nil
        AuthService.shared.endWebAuthentication()
        device = nil
        errorMessage = nil
    }
}

private struct MobileSignInView: View {
    @EnvironmentObject private var state: AppState
    @StateObject private var model = MobileSignInModel()
    @State private var demoLoading = false
    @State private var demoError: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "rectangle.stack.badge.person.crop")
                    .font(.system(size: 54, weight: .semibold))
                    .foregroundStyle(MobileTheme.gradient)
                    .accessibilityHidden(true)

                VStack(spacing: 8) {
                    Text("NoxHere")
                        .font(.largeTitle.bold())
                    Text("Your development feed, wherever you are.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                if let device = model.device {
                    VStack(spacing: 12) {
                        Text("GitHub sign-in code")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(device.userCode)
                            .font(.system(.title2, design: .monospaced, weight: .bold))
                            .textSelection(.enabled)
                        Text("The code is copied. Paste it into the GitHub page, approve NoxHere, then return here.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Open GitHub again") { model.openGitHub(for: device) }
                            .buttonStyle(.borderedProminent)
                        Button("Start over", role: .cancel) { model.cancel() }
                    }
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
                } else {
                    Button {
                        model.start()
                    } label: {
                        HStack {
                            if model.isLoading { ProgressView() }
                            Text("Continue with GitHub")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(model.isLoading)
                }

                HStack(spacing: 12) {
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                    Text("or").font(.caption).foregroundStyle(.secondary)
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                }

                Button {
                    startDemo()
                } label: {
                    HStack {
                        if demoLoading { ProgressView() }
                        Text(demoLoading ? "Loading demo…" : "Preview with demo data")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(model.isLoading || demoLoading)

                Text("The demo is read-only and does not require a GitHub account.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if let error = model.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                if let demoError {
                    Text(demoError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                Spacer()
                Text("Authentication and GitHub access are handled by NoxHere.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            .padding(28)
        }
    }

    private func startDemo() {
        demoLoading = true
        demoError = nil
        Task {
            defer { demoLoading = false }
            do {
                try await state.enterDemo()
            } catch {
                demoError = "The demo could not start. Check your connection and try again."
            }
        }
    }
}

private struct MobileOrganizationPicker: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        NavigationStack {
            Group {
                if state.activeWorkspaces.isEmpty {
                    ContentUnavailableView(
                        "No GitHub workspaces",
                        systemImage: "person.2",
                        description: Text(state.lastError ?? "Refresh your GitHub account and try again.")
                    )
                } else {
                    List(state.activeWorkspaces) { workspace in
                        Button { state.selectOrg(workspace.login) } label: {
                            Label(
                                workspace.displayName,
                                systemImage: workspace.kind == .personal ? "person.crop.circle" : "building.2"
                            )
                        }
                    }
                }
            }
            .navigationTitle("Choose workspace")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await state.refreshOrganizations() } } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Sign out", role: .destructive) { state.signOutActive() }
                }
            }
        }
    }
}
