import SwiftUI

/// First-run GitHub sign-in. Account creation is not needed: NoxHere uses the
/// user's GitHub identity and stores its token in the macOS Keychain.
struct OnboardingView: View {
    @EnvironmentObject private var state: AppState
    var onDone: (() -> Void)? = nil
    var allowsDemo: Bool = true

    @State private var stage: Stage = .welcome
    @State private var deviceInit: AuthService.DeviceInit?
    @State private var errorMessage: String?
    @State private var demoLoading = false

    enum Stage { case welcome, requesting, codeReady, waiting, done }

    var body: some View {
        SetupPage(
            step: 1,
            title: "Sign in",
            icon: stage == .done ? "checkmark.circle.fill" : "rectangle.stack.badge.person.crop",
            headline: headline,
            message: message
        ) {
            VStack(spacing: 14) {
                switch stage {
                case .welcome:
                    welcomeActions
                case .requesting:
                    ProgressView().controlSize(.regular).tint(UT.accent)
                    Text("Getting a secure code from GitHub…")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                case .codeReady, .waiting:
                    if let deviceInit {
                        DeviceCodeCard(
                            userCode: deviceInit.userCode,
                            verificationUri: deviceInit.verificationUri,
                            isWaiting: stage == .waiting,
                            onContinue: { continueInGitHub() }
                        )
                    }
                case .done:
                    ProgressView().tint(UT.accent)
                    Text("GitHub approved. Loading your teams…")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(RoundedRectangle(cornerRadius: 9).fill(Color.red.opacity(0.08)))
                }
            }
        }
    }

    private var headline: String {
        switch stage {
        case .welcome: "Welcome to NoxHere"
        case .requesting: "Starting GitHub sign-in"
        case .codeReady: "Your GitHub code is ready"
        case .waiting: "Approve the code in GitHub"
        case .done: "You are signed in"
        }
    }

    private var message: String {
        switch stage {
        case .welcome: OnboardingCopy.welcome
        case .requesting: OnboardingCopy.signInNote
        case .codeReady: "We copied the code below. Continue to GitHub, paste it, and approve access."
        case .waiting: "Paste the copied code into GitHub and approve access. NoxHere will continue automatically."
        case .done: "NoxHere is finding the organizations linked to your GitHub account."
        }
    }

    private var welcomeActions: some View {
        VStack(spacing: 14) {
            VStack(spacing: 8) {
                SetupTip(icon: "menubar.rectangle", title: "Made for your menu bar", text: "Open the feed at any time without leaving your work.")
                SetupTip(icon: "lock.shield", title: "You stay in control", text: "GitHub shows each request. Your sign-in token stays in the macOS Keychain.")
            }

            SetupPrimaryButton(title: "Connect GitHub") {
                Task { await start() }
            }
            .disabled(demoLoading)

            Text("A secure GitHub page will open. NoxHere does not ask for a new password.")
                .font(.system(size: 10))
                .foregroundStyle(UT.textTertiary)
                .multilineTextAlignment(.center)

            if allowsDemo {
                HStack(spacing: 10) {
                    Rectangle().fill(UT.border).frame(height: 1)
                    Text("OR").font(.system(size: 9, weight: .medium)).foregroundStyle(UT.textTertiary)
                    Rectangle().fill(UT.border).frame(height: 1)
                }

                Button {
                    Task { await startDemo() }
                } label: {
                    HStack(spacing: 7) {
                        if demoLoading { ProgressView().controlSize(.small) }
                        Image(systemName: "sparkles.rectangle.stack")
                        Text(demoLoading ? "Loading demo…" : "Preview with demo data")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(UT.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(
                        RoundedRectangle(cornerRadius: 9)
                            .fill(UT.card)
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(UT.accent.opacity(0.35)))
                    )
                }
                .buttonStyle(.plain)
                .disabled(demoLoading)

                Text("The demo is read-only and does not use a GitHub account.")
                    .font(.system(size: 10))
                    .foregroundStyle(UT.textTertiary)
            }
        }
    }

    private func start() async {
        errorMessage = nil
        stage = .requesting
        do {
            let device = try await AuthService.shared.startDeviceFlow()
            deviceInit = device
            copy(device.userCode)
            stage = .codeReady
        } catch {
            stage = .welcome
            errorMessage = error.userFacingDescription
        }
    }

    private func continueInGitHub() {
        guard let device = deviceInit else { return }
        errorMessage = nil
        copy(device.userCode)
        do {
            try AuthService.shared.beginWebAuthentication(at: device.verificationUri)
            stage = .waiting
            Task { await waitForGitHub(device) }
        } catch {
            errorMessage = error.userFacingDescription
        }
    }

    private func waitForGitHub(_ device: AuthService.DeviceInit) async {
        do {
            try await AuthService.shared.pollForAccessToken(device)
            AuthService.shared.endWebAuthentication()
            stage = .done
            onDone?()
        } catch {
            AuthService.shared.endWebAuthentication()
            deviceInit = nil
            stage = .welcome
            errorMessage = error.userFacingDescription
        }
    }

    private func startDemo() async {
        errorMessage = nil
        demoLoading = true
        defer { demoLoading = false }
        do {
            try await state.enterDemo()
            onDone?()
        } catch {
            errorMessage = "The demo could not start. Check your connection and try again."
        }
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}

struct DeviceCodeCard: View {
    let userCode: String
    let verificationUri: URL
    let isWaiting: Bool
    let onContinue: () -> Void
    @State private var copyConfirmation = true

    var body: some View {
        VStack(spacing: 13) {
            VStack(alignment: .leading, spacing: 9) {
                instruction(number: "1", text: "Your sign-in code is copied.")
                instruction(
                    number: "2",
                    text: isWaiting ? "Paste the code into the GitHub page." : "Continue to GitHub and paste the code."
                )
                instruction(number: "3", text: "Approve access. NoxHere will finish here.")
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 5) {
                ForEach(Array(userCode.enumerated()), id: \.offset) { _, character in
                    Text(String(character))
                        .font(.system(size: 18, weight: .semibold, design: .monospaced))
                        .foregroundStyle(UT.textPrimary)
                        .frame(width: 25, height: 34)
                        .background(RoundedRectangle(cornerRadius: 5).fill(UT.card))
                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(UT.border))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("GitHub code \(userCode)")

            Label(
                copyConfirmation ? "Copied to clipboard" : "Ready to copy",
                systemImage: copyConfirmation ? "checkmark.circle.fill" : "doc.on.doc"
            )
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(copyConfirmation ? UT.accent : UT.textMuted)

            if !isWaiting {
                SetupPrimaryButton(title: "Continue to GitHub") {
                    onContinue()
                }
            }

            HStack(spacing: 18) {
                Button("Copy code again") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(userCode, forType: .string)
                    copyConfirmation = true
                }
                .buttonStyle(.plain)
                .foregroundStyle(UT.accent)
                .font(.system(size: 11, weight: .medium))

                if isWaiting {
                    Button("Open GitHub again") {
                        // Reopening is an ordinary browser action. Starting a
                        // second ASWebAuthenticationSession races the cancelled
                        // session's completion handler and can close immediately.
                        NSWorkspace.shared.open(verificationUri)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(UT.accent)
                    .font(.system(size: 11, weight: .medium))
                }
            }

            if isWaiting {
                HStack(spacing: 7) {
                    ProgressView().controlSize(.small).tint(UT.accent)
                    Text("Waiting for approval in GitHub…")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 11).fill(UT.card))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(UT.border))
    }

    private func instruction(number: String, text: String) -> some View {
        HStack(spacing: 9) {
            Text(number)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(UT.onAccent)
                .frame(width: 19, height: 19)
                .background(Circle().fill(UT.accent))
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(UT.textMuted)
        }
    }
}
