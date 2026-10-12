import SwiftUI

struct ManagePeopleSheet: View {
    @EnvironmentObject private var state: AppState
    let onDone: () -> Void
    let showsHeader: Bool

    @State private var members: [APIClient.OrgMember] = []
    @State private var excluded: Set<String> = []
    @State private var settingsBlob: [String: AnyJSON] = [:]
    @State private var loading = true
    @State private var savingLogin: String?
    @State private var errorMessage: String?

    init(showsHeader: Bool = true, onDone: @escaping () -> Void = {}) {
        self.showsHeader = showsHeader
        self.onDone = onDone
    }

    var body: some View {
        VStack(spacing: 0) {
            if showsHeader {
                ManagementSheetHeader(title: "Team visibility", onDone: onDone)
                Divider().overlay(UT.border)
            }
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(UT.surface)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if loading {
            CenteredProgressView()
        } else if let err = errorMessage, members.isEmpty {
            RetryErrorView(message: err) { Task { await load() } }
        } else {
            ScrollView {
                LazyVStack(spacing: 6) {
                    Text("Uncheck a teammate to hide their PRs, issues, reviews, and posts everywhere.")
                        .font(.system(size: 11))
                        .foregroundStyle(UT.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 4)
                    ForEach(members) { m in
                        PersonRow(
                            member: m,
                            included: !excluded.contains(m.login),
                            saving: savingLogin == m.login,
                            onToggle: { Task { await toggle(m) } }
                        )
                    }
                }
                .padding(14)
            }
        }
    }

    private func load() async {
        loading = true; defer { loading = false }
        errorMessage = nil
        let client = state.makeAPIClient()
        async let m = try? await client.fetchMembers()
        async let s = try? await client.fetchSettings()
        let (fetchedMembers, fetchedSettings) = await (m, s)
        if let fetchedMembers { self.members = fetchedMembers }
        if let fetchedSettings {
            self.settingsBlob = fetchedSettings
            self.excluded = client.excludedMembers(from: fetchedSettings)
        } else if fetchedMembers == nil {
            errorMessage = "Couldn't load team + settings."
        }
    }

    private func toggle(_ m: APIClient.OrgMember) async {
        savingLogin = m.login
        defer { savingLogin = nil }
        var next = excluded
        if next.contains(m.login) { next.remove(m.login) } else { next.insert(m.login) }
        let client = state.makeAPIClient()
        let updated = client.settingsWithExcludedMembers(settingsBlob, next)
        do {
            try await client.putSettings(updated)
            self.settingsBlob = updated
            self.excluded = next
        } catch {
            errorMessage = error.userFacingDescription
        }
    }
}

private struct PersonRow: View {
    let member: APIClient.OrgMember
    let included: Bool
    let saving: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Avatar(url: member.avatarUrl, initials: String(member.login.prefix(1)).uppercased(), size: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(member.login)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(included ? UT.textPrimary : UT.textMuted)
                    .lineLimit(1)
                if !included {
                    Text("Hidden").font(.system(size: 10)).foregroundStyle(UT.textTertiary)
                }
            }
            Spacer()
            if saving {
                ProgressView().controlSize(.small)
            } else {
                Toggle("", isOn: Binding(
                    get: { included },
                    set: { _ in onToggle() }
                ))
                .toggleStyle(.switch)
                .controlSize(.mini)
                .labelsHidden()
                .tint(UT.accent)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .cardStyle()
    }
}
