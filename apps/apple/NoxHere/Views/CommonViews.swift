import SwiftUI

struct CenteredProgressView: View {
    var body: some View {
        VStack {
            Spacer()
            ProgressView().tint(UT.accent)
            Spacer()
        }
    }
}

struct RetryErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.system(size: 22))
            Text(message)
                .multilineTextAlignment(.center)
                .font(.system(size: 12))
                .foregroundStyle(UT.textMuted)
                .padding(.horizontal, 20)
            Button("Retry", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(UT.accent)
            Spacer()
        }
        .padding()
    }
}

struct ManagementSheetHeader: View {
    let title: String
    let onDone: () -> Void

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(UT.textPrimary)
            Spacer()
            Button("Done", action: onDone)
                .buttonStyle(.plain)
                .foregroundStyle(UT.accent)
                .font(.system(size: 12, weight: .medium))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(UT.card)
    }
}

private struct CardStyle: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content.background(
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(UT.card)
                .overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(UT.border))
        )
    }
}

extension View {
    func cardStyle(cornerRadius: CGFloat = 8) -> some View {
        modifier(CardStyle(cornerRadius: cornerRadius))
    }
}
