import SwiftUI
import UserNotifications

/// Device-local notification controls shown in the Settings window.
struct NotificationSettingsPane: View {
    @ObservedObject var settings: NotificationSettings
    let onTest: () -> Void

    @State private var authStatus: UNAuthorizationStatus?
    @State private var testSent = false

    var body: some View {
        SettingsPage(
            title: "Notifications",
            subtitle: "Choose which NoxHere activity should reach this Mac."
        ) {
            SettingsCard(title: "macOS permission", icon: "bell.badge") {
                permissionRow
            }

            SettingsCard(title: "Activity", icon: "bolt.fill") {
                Toggle("Enable notifications", isOn: $settings.enabled)
                    .font(.system(size: 13, weight: .semibold))

                VStack(alignment: .leading, spacing: 10) {
                    Toggle("New PR opened", isOn: $settings.newPRs)
                    Toggle("Skip draft PRs", isOn: $settings.newPRsSkipDrafts)
                        .padding(.leading, 18)
                        .disabled(!settings.newPRs)
                    Toggle("Skip my own PRs", isOn: $settings.newPRsSkipOwn)
                        .padding(.leading, 18)
                        .disabled(!settings.newPRs)

                    Toggle("My PR merged", isOn: $settings.myPRMerged)
                    Toggle("My PR closed without merging", isOn: $settings.myPRClosed)
                    Toggle("Reviews on my PRs", isOn: $settings.reviewsOnMyPRs)
                    Toggle("Issues assigned to me", isOn: $settings.issuesAssigned)
                    Toggle("Review requests for me", isOn: $settings.reviewRequests)
                }
                .font(.system(size: 12))
                .disabled(!settings.enabled)
            }

            SettingsCard(title: "Delivery behavior", icon: "speaker.wave.2.fill") {
                Toggle("Break through Focus (Time Sensitive)", isOn: $settings.timeSensitive)
                Toggle("Play sound", isOn: $settings.playSound)
            }
            .disabled(!settings.enabled)

            SettingsCard(title: "Test", icon: "paperplane.fill") {
                HStack(spacing: 8) {
                    Button(testSent ? "Sent — check your notifications" : "Send test notification") {
                        onTest()
                        testSent = true
                    }
                    .controlSize(.small)
                    .disabled(testSent)
                    if testSent {
                        Button("Send again") { onTest() }
                            .controlSize(.small)
                    }
                }
            }
        }
        .toggleStyle(.checkbox)
        .foregroundStyle(UT.textPrimary)
        .task { await refreshAuthStatus() }
    }

    /// macOS-level permission state with a fix-it action. Toggles below are
    /// meaningless while delivery is blocked, so surface that loudly.
    @ViewBuilder
    private var permissionRow: some View {
        switch authStatus {
        case .some(.denied):
            HStack(spacing: 8) {
                Image(systemName: "bell.slash.fill").foregroundStyle(.orange)
                Text("Notifications are blocked for NoxHere in System Settings.")
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
                Button("Open System Settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.notifications") {
                        NSWorkspace.shared.open(url)
                    }
                }
                .controlSize(.small)
            }
        case .some(.notDetermined):
            HStack(spacing: 8) {
                Image(systemName: "bell.badge").foregroundStyle(UT.accent)
                Text("macOS hasn't been asked yet.")
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textPrimary)
                Spacer()
                Button("Allow notifications…") {
                    Task {
                        _ = try? await UNUserNotificationCenter.current()
                            .requestAuthorization(options: [.alert, .sound])
                        await refreshAuthStatus()
                    }
                }
                .controlSize(.small)
            }
        case .some:
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                Text("Notifications are allowed in macOS.")
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textMuted)
            }
        case .none:
            EmptyView()
        }
    }

    private func refreshAuthStatus() async {
        authStatus = await UNUserNotificationCenter.current()
            .notificationSettings().authorizationStatus
    }
}
