import AppKit
import UserNotifications

/// AppKit delegate owning the UserNotifications behavior SwiftUI can't
/// express declaratively: keep banners visible while the popover is
/// frontmost, and route notification clicks to the PR's GitHub URL in the
/// default browser — so it works even when a notification cold-launches
/// the app.
final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        ProcessInfo.processInfo.disableAutomaticTermination("NoxHere monitors the menu bar in the background")
        ProcessInfo.processInfo.disableSuddenTermination()

        // Delivery and response handling are separate in UserNotifications.
        // NotifierStore already embeds the GitHub URL; the delegate owns the
        // click so it also works when a notification cold-launches the app.
        UNUserNotificationCenter.current().delegate = self
    }

    /// NoxHere is a menu-bar utility. Closing the transient popover window
    /// must never be interpreted as closing the application.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Assigning a delegate changes foreground behavior. Keep banners
        // visible while the menubar popover is active.
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        defer { completionHandler() }
        guard let raw = response.notification.request.content.userInfo["url"] as? String,
              let url = URL(string: raw),
              url.scheme?.lowercased() == "https",
              url.host?.lowercased() == "github.com"
        else { return }
        DispatchQueue.main.async {
            NSWorkspace.shared.open(url)
        }
    }
}
