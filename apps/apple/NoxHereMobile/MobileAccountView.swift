import SwiftUI

struct MobileAccountView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.openURL) private var openURL

    var body: some View {
        Form {
            Section("Account") {
                LabeledContent("GitHub", value: state.activeLogin ?? "—")
                if state.visibleAccounts.count > 1 {
                    Picker("Account", selection: Binding(
                        get: { state.activeLogin ?? "" },
                        set: { state.switchToAccount(login: $0) }
                    )) {
                        ForEach(state.visibleAccounts) { account in
                            Text(account.login).tag(account.login)
                        }
                    }
                }
            }

            Section("Workspace") {
                Picker("GitHub workspace", selection: Binding(
                    get: { state.activeOrg ?? "" },
                    set: { state.selectOrg($0.isEmpty ? nil : $0) }
                )) {
                    ForEach(state.activeWorkspaces) { workspace in
                        Text(workspace.displayName).tag(workspace.login)
                    }
                }
                Button("Refresh workspaces") {
                    Task { await state.refreshOrganizations() }
                }
            }

            Section("NoxHere") {
                LabeledContent("Connection") {
                    Label(
                        state.activeOrgIsConnected ? "Connected" : "Needs attention",
                        systemImage: state.activeOrgIsConnected ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                    )
                    .foregroundStyle(state.activeOrgIsConnected ? .green : .orange)
                }
                Button("Open NoxHere") { openURL(Config.apiBase) }
            }

            Section {
                Button("Sign out", role: .destructive) { state.signOutActive() }
            }
        }
        .navigationTitle("Account")
    }
}
