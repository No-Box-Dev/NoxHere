import SwiftUI

struct AccountSwitcherButton: View {
    let accounts: [Account]
    let activeLogin: String?
    let orgsPerLogin: [String: [String]]
    let orgConnectionsPerLogin: [String: [String: Bool]]
    let activeOrg: String?
    let isAdmin: Bool
    let isDemo: Bool
    let onPickOrg: (String, String) -> Void
    let onAddAccount: () -> Void
    let onSignOut: (String) -> Void

    private var organizationLabel: String {
        guard let activeLogin, let activeOrg else { return "Choose workspace" }
        if activeOrg.caseInsensitiveCompare(activeLogin) == .orderedSame {
            return "Personal · @\(activeLogin)"
        }
        return activeOrg
    }

    private var isPersonalWorkspaceActive: Bool {
        guard let activeLogin, let activeOrg else { return false }
        return activeOrg.caseInsensitiveCompare(activeLogin) == .orderedSame
    }

    var body: some View {
        Menu {
            ForEach(accounts) { account in
                Section(header: Text("@\(account.login)")) {
                    let orgs = orgsPerLogin[account.login] ?? []
                    Button {
                        onPickOrg(account.login, account.login)
                    } label: {
                        if account.login == activeLogin,
                           account.selectedOrg?.caseInsensitiveCompare(account.login) == .orderedSame {
                            Label("Personal account", systemImage: "checkmark")
                        } else {
                            Label("Personal account", systemImage: "person.crop.circle")
                        }
                    }
                    Divider()
                    if orgs.isEmpty {
                        Text("No organizations").foregroundStyle(.secondary)
                    } else {
                        ForEach(orgs, id: \.self) { org in
                            let isConnected = orgConnectionsPerLogin[account.login]?[org.lowercased()]
                            Button {
                                onPickOrg(account.login, org)
                            } label: {
                                if account.login == activeLogin && account.selectedOrg == org {
                                    Label(org, systemImage: "checkmark")
                                } else if isConnected == false {
                                    Label(org, systemImage: "link.badge.plus")
                                } else {
                                    Text(org)
                                }
                            }
                        }
                    }
                    Button(isDemo ? "Exit demo" : "Sign out @\(account.login)") { onSignOut(account.login) }
                }
            }
            Divider()
            Button(isDemo ? "Add another account… (Unavailable in Demo)" : "Add another account…", action: onAddAccount)
                .disabled(isDemo)
        } label: {
            HStack(spacing: 8) {
                if activeLogin != nil {
                    Image(systemName: isPersonalWorkspaceActive ? "person.crop.circle.fill" : "building.2.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(UT.textMuted)
                    Text(organizationLabel)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(UT.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                } else {
                    Text("No account").font(.system(size: 12)).foregroundStyle(UT.textMuted)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9))
                    .foregroundStyle(UT.textTertiary)
            }
            .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize(horizontal: true, vertical: false)
        .accessibilityLabel("GitHub workspace and account")
    }
}

struct AddAccountSheet: View {
    @EnvironmentObject private var state: AppState
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Add another GitHub account")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                Spacer()
                Button("Cancel", action: onDone)
                    .buttonStyle(.plain)
                    .foregroundStyle(UT.accent)
                    .font(.system(size: 12, weight: .medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(UT.card)
            Divider().overlay(UT.border)
            OnboardingView(onDone: onDone, allowsDemo: false)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(UT.surface)
    }
}
