import XCTest

final class SettingsWindowUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app.terminate()
        app = nil
    }

    func testEverySettingsPageIsReachable() throws {
        app.launchArguments = ["--start-demo", "--open-settings"]
        app.launch()

        let settingsWindow = app.windows["NoxHere Settings"]
        XCTAssertTrue(settingsWindow.waitForExistence(timeout: 8))

        let sections = [
            (id: "workspace", title: "Workspace"),
            (id: "repositories", title: "Repositories"),
            (id: "people", title: "People"),
            (id: "narration", title: "Narration"),
            (id: "delivery", title: "Delivery"),
            (id: "notifications", title: "Notifications"),
            (id: "maintenance", title: "Maintenance"),
        ]

        for section in sections {
            app.activate()
            let identifier = "settings-sidebar-\(section.id)"
            var sidebarItem = settingsWindow.descendants(matching: .any)[identifier]
            XCTAssertTrue(sidebarItem.waitForExistence(timeout: 3), "Missing sidebar section: \(section.title)")
            if !sidebarItem.isHittable {
                app.activate()
                sidebarItem = settingsWindow.descendants(matching: .any)[identifier]
                XCTAssertTrue(sidebarItem.waitForExistence(timeout: 3), "Sidebar section became unavailable: \(section.title)")
            }
            sidebarItem.click()
            XCTAssertTrue(
                settingsWindow.descendants(matching: .any)["settings-page-\(section.id)"].waitForExistence(timeout: 3),
                "The \(section.title) detail page did not open"
            )
        }
    }

    func testSettingsMenuOpensAVisibleWindow() throws {
        app.launchArguments = ["--start-demo"]
        app.launch()

        let openDemo = app.buttons["Open the demo feed"]
        if openDemo.waitForExistence(timeout: 3) {
            openDemo.click()
        }

        let actions = app.descendants(matching: .any)["Settings and actions"]
        XCTAssertTrue(actions.waitForExistence(timeout: 8))
        actions.click()

        let settingsItem = app.descendants(matching: .any)["Settings…"]
        XCTAssertTrue(settingsItem.waitForExistence(timeout: 3))
        settingsItem.click()

        let settingsWindow = app.windows["NoxHere Settings"]
        XCTAssertTrue(settingsWindow.waitForExistence(timeout: 5))
        XCTAssertTrue(settingsWindow.isHittable)
    }
}
