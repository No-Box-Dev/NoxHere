import SwiftUI

@main
struct NoxFeedMobileApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup {
            MobileRootView()
                .environmentObject(state)
                .environmentObject(state.accounts)
                .tint(MobileTheme.accent)
        }
    }
}

enum MobileTheme {
    static let accent = Color(red: 239 / 255, green: 121 / 255, blue: 116 / 255)
    static let violet = Color(red: 155 / 255, green: 120 / 255, blue: 244 / 255)
    static let gradient = LinearGradient(
        colors: [accent, violet],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
