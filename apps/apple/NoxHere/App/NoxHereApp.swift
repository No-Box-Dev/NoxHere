import SwiftUI
import KeyboardShortcuts
import MenuBarExtraAccess

@main
struct NoxHereApp: App {
    @StateObject private var state = AppState()
    @StateObject private var notifier = NotifierStore()
    @StateObject private var timelineCache = TimelineCache()
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra {
            RootView()
                .environmentObject(state)
                .environmentObject(state.accounts)
                .environmentObject(notifier)
                .environmentObject(timelineCache)
                .frame(width: 570, height: 780, alignment: .top)
        } label: {
            // The label is mounted for the app's lifetime — perfect anchor
            // for launch-time work (hotkey registration, background
            // notifier) that must happen after the AppKit run loop is ready.
            MenuBarLabel()
                .environmentObject(state)
                .modifier(LaunchTasks(
                    appDelegate: appDelegate,
                    state: state,
                    notifier: notifier,
                    popoverOpen: $state.popoverOpen
                ))
        }
        .menuBarExtraAccess(isPresented: $state.popoverOpen)
        .menuBarExtraStyle(.window)

        Window("NoxHere Settings", id: "noxhere-settings") {
            SettingsWindow()
                .environmentObject(state)
                .environmentObject(state.accounts)
                .environmentObject(notifier)
                .environmentObject(timelineCache)
        }
        .defaultSize(width: 920, height: 660)
        .windowResizability(.contentMinSize)
    }
}

/// Bridges AppKit + SwiftUI at launch:
///   - Registers the global ⌘⇧X hotkey that toggles the popover.
///   - Starts the background notifier (polls regardless of popover state).
private struct LaunchTasks: ViewModifier {
    @Environment(\.openWindow) private var openWindow
    let appDelegate: AppDelegate
    let state: AppState
    let notifier: NotifierStore
    @Binding var popoverOpen: Bool

    func body(content: Content) -> some View {
        content.task {
            // A hosted unit-test bundle launches the app executable. Do not
            // register global shortcuts or request notification permission.
            guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil else { return }
            KeyboardShortcuts.onKeyDown(for: .toggleFeed) {
                popoverOpen.toggle()
            }

            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--start-demo") {
                try? await state.enterDemo()
                popoverOpen = true
            }
            if ProcessInfo.processInfo.arguments.contains("--onboarding-preview-welcome") {
                popoverOpen = true
            }
            if ProcessInfo.processInfo.arguments.contains("--open-settings") {
                openWindow(id: "noxhere-settings")
            }
            #endif

            // NoxHere has no Dock window. A new user would otherwise see only
            // a dim menu-bar icon and may never discover setup.
            if state.phase == .signedOut {
                popoverOpen = true
            }

            // Background notifier — app-lifetime, polls regardless of
            // whether the popover is open.
            notifier.start(
                client: { [weak state] in state?.makeAPIClient() },
                login: { [weak state] in state?.activeLogin },
                org: { [weak state] in state?.activeOrg }
            )
        }
    }
}

private struct MenuBarLabel: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        // Custom template image (asset catalog flag `template-rendering-intent
        // = template`) so macOS tints it correctly for light/dark menu bars.
        // Slightly reduced opacity when signed-out so the row communicates
        // "not connected" without a second badge.
        Image("MenuBarIcon")
            .opacity(state.phase == .ready ? 1.0 : 0.55)
    }
}
