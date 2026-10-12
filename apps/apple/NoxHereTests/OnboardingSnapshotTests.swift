import AppKit
import SwiftUI
import XCTest
@testable import NoxHere

@MainActor
final class OnboardingSnapshotTests: XCTestCase {
    func testFiveModeNavigationAndIssuesRenderAtPopoverSize() throws {
        let state = AppState()
        let issues = [
            Issue(
                id: 1, repo: "noxhere", number: 42, title: "Menu-bar picker should preserve its selected tab",
                state: "open", assignees: [.init(login: "jasper", avatarUrl: nil)],
                labels: [.init(name: "critical", color: "ef4444")],
                createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
                closedAt: nil, htmlUrl: "https://github.com/example/noxhere/issues/42"
            ),
            Issue(
                id: 2, repo: "noxhere", number: 43, title: "Add issue grouping by repository",
                state: "open", assignees: [], labels: [.init(name: "enhancement", color: "6d5cc8")],
                createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
                closedAt: nil, htmlUrl: "https://github.com/example/noxhere/issues/43"
            ),
        ]
        let members = [APIClient.OrgMember(login: "jasper", avatarUrl: nil)]
        let view = VStack(spacing: 0) {
            ModePicker(mode: .constant(.issues), onChange: {})
                .padding(14)
            IssuesView(previewIssues: issues, previewMembers: members)
                .environmentObject(state)
        }
        .background(UT.surface)

        try render(view, name: "noxhere-issues-light")
        try render(view, name: "noxhere-issues-dark", appearance: .darkAqua)
    }

    func testWelcomeAndReadyPagesRenderAtPopoverSize() throws {
        let state = AppState()

        let welcome = OnboardingView()
            .environmentObject(state)
        try render(welcome, name: "noxhere-onboarding-welcome")

        let loading = OrganizationLoadingState()
            .environmentObject(state)
        try render(loading, name: "noxhere-onboarding-loading")

        let noOrganization = NoOrganizationState()
            .environmentObject(state)
        try render(noOrganization, name: "noxhere-onboarding-no-org")

        let connect = ConnectOrganizationState()
            .environmentObject(state)
        try render(connect, name: "noxhere-onboarding-connect")

        let ready = SetupCompleteState(onContinue: {})
            .environmentObject(state)
        try render(ready, name: "noxhere-onboarding-ready")

        let deviceCodeReady = DeviceCodeCard(
            userCode: "ABCD-1234",
            verificationUri: URL(string: "https://github.com/login/device")!,
            isWaiting: false,
            onContinue: {}
        )
        try render(deviceCodeReady, name: "noxhere-onboarding-device-code-ready", size: NSSize(width: 410, height: 330))

        let deviceCodeWaiting = DeviceCodeCard(
            userCode: "ABCD-1234",
            verificationUri: URL(string: "https://github.com/login/device")!,
            isWaiting: true,
            onContinue: {}
        )
        try render(deviceCodeWaiting, name: "noxhere-onboarding-device-code-waiting", size: NSSize(width: 410, height: 300))

        // NoxKey's dogfood build uses its dark appearance. Keep both ends of
        // the shared adaptive palette renderable so NoxHere cannot silently
        // regress to light-only colors again.
        try render(welcome, name: "noxhere-onboarding-welcome-dark", appearance: .darkAqua)
        try render(ready, name: "noxhere-onboarding-ready-dark", appearance: .darkAqua)
    }

    private func render<V: View>(
        _ view: V,
        name: String,
        appearance: NSAppearance.Name = .aqua,
        size: NSSize = NSSize(width: 570, height: 780)
    ) throws {
        let host = NSHostingView(rootView: view)
        host.frame = NSRect(origin: .zero, size: size)
        let window = NSWindow(
            contentRect: host.frame,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        window.appearance = NSAppearance(named: appearance)
        window.contentView = host
        host.layoutSubtreeIfNeeded()

        let bitmap = try XCTUnwrap(host.bitmapImageRepForCachingDisplay(in: host.bounds))
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let png = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
        let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("\(name).png")
        try png.write(to: url, options: .atomic)

        XCTAssertGreaterThan(png.count, 20_000, "Rendered page looks blank")
        XCTAssertEqual(host.bounds.size, size)
    }
}
