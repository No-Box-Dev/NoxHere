import SwiftUI

enum OnboardingCopy {
    // Body copy is kept in one place so its reading level can be tested.
    static let welcome = "See what your team opened, merged, and shipped. NoxHere stays in your menu bar, so each update is easy to scan."
    static let signInNote = "GitHub will open in a safe window. Sign in, paste the code, and allow NoxHere."
    static let connectionNote = "NoxHere is a GitHub app. It sends pull request news from your team to NoxHere. You choose the repos it can read."
    static let noOrganization = "Use your personal GitHub account, or refresh after joining an organization."
    static let install = "Add NoxHere to this org. Pick all repos, or pick just the ones your team wants to track."
    static let ready = "Your team is now linked. New pull request activity will show up in NoxHere."
    static let tabs = "Current shows work that needs care. Opened and Merged show new work. Notes shows what your team shipped."

    static let readabilityText = [welcome, signInNote, connectionNote, noOrganization, install, ready, tabs].joined(separator: " ")
}

struct SetupProgressHeader: View {
    let step: Int
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(1...3, id: \.self) { item in
                    Capsule()
                        .fill(item <= step ? UT.accent : UT.border)
                        .frame(maxWidth: .infinity)
                        .frame(height: 3)
                }
            }
            Text("Step \(step) of 3 · \(title)")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(UT.textMuted)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(step) of 3, \(title)")
    }
}

struct SetupPage<Content: View>: View {
    let step: Int
    let title: String
    let icon: String
    let headline: String
    let message: String
    @ViewBuilder let content: Content

    init(
        step: Int,
        title: String,
        icon: String,
        headline: String,
        message: String,
        @ViewBuilder content: () -> Content
    ) {
        self.step = step
        self.title = title
        self.icon = icon
        self.headline = headline
        self.message = message
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SetupProgressHeader(step: step, title: title)

                Image(systemName: icon)
                    .font(.system(size: 25, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(RoundedRectangle(cornerRadius: 14).fill(UT.brandGradient))

                VStack(spacing: 8) {
                    Text(headline)
                        .font(.title3.bold())
                        .foregroundStyle(UT.textPrimary)
                    Text(message)
                        .font(.system(size: 13))
                        .foregroundStyle(UT.textMuted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .frame(maxWidth: 390)
                }

                content
                    .frame(maxWidth: 410)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
        }
        .background(UT.surface)
    }
}

struct SetupTip: View {
    let icon: String
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(UT.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(UT.textPrimary)
                Text(text)
                    .font(.system(size: 11))
                    .foregroundStyle(UT.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(UT.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(UT.border))
    }
}

struct SetupPrimaryButton: View {
    let title: String
    var loading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if loading { ProgressView().controlSize(.small).tint(UT.onAccent) }
                Text(title).font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(UT.onAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 8).fill(UT.accent))
        }
        .buttonStyle(.plain)
        .disabled(loading)
    }
}
