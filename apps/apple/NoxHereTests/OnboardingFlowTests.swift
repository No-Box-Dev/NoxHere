import XCTest
@testable import NoxHere

final class OnboardingFlowTests: XCTestCase {
    func testFreshInstallStartsAtWelcome() {
        XCTAssertEqual(route(signedIn: false), .welcome)
    }

    func testSignedInUserWaitsForOrganizations() {
        XCTAssertEqual(route(signedIn: true), .loadingOrganizations)
    }

    func testUserWithoutOrganizationGetsARecoveryPath() {
        XCTAssertEqual(
            route(signedIn: true, loaded: true),
            .noOrganizations
        )
    }

    func testOrganizationWithoutNoxHereGetsInstallStep() {
        XCTAssertEqual(
            route(signedIn: true, loaded: true, hasOrg: true),
            .connectOrganization
        )
    }

    func testConnectedUserSeesSetupSummaryOnce() {
        XCTAssertEqual(
            route(signedIn: true, loaded: true, hasOrg: true, connected: true),
            .setupComplete
        )
    }

    func testReturningConnectedUserOpensFeed() {
        XCTAssertEqual(
            route(signedIn: true, loaded: true, hasOrg: true, connected: true, completed: true),
            .feed
        )
    }

    func testWelcomePreviewYieldsAfterEitherOnboardingChoice() {
        let arguments = ["NoxHere", "--onboarding-preview-welcome"]
        XCTAssertTrue(OnboardingFlow.forcesWelcomePreview(arguments: arguments, previewWasCompleted: false))
        XCTAssertFalse(OnboardingFlow.forcesWelcomePreview(arguments: arguments, previewWasCompleted: true))
    }

    func testCompletionIsScopedToAccountAndOrganization() throws {
        let suite = "OnboardingFlowTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        XCTAssertFalse(OnboardingCompletionStore.isComplete(login: "sam", organization: "north", defaults: defaults))
        OnboardingCompletionStore.markComplete(login: "sam", organization: "north", defaults: defaults)
        XCTAssertTrue(OnboardingCompletionStore.isComplete(login: "sam", organization: "north", defaults: defaults))
        XCTAssertFalse(OnboardingCompletionStore.isComplete(login: "sam", organization: "south", defaults: defaults))
        XCTAssertFalse(OnboardingCompletionStore.isComplete(login: "lee", organization: "north", defaults: defaults))
    }

    func testMainOnboardingCopyHasFleschScoreFrom80To90() {
        let score = fleschReadingEase(OnboardingCopy.readabilityText)
        XCTAssertGreaterThanOrEqual(score, 80, "Copy was too hard to read. Score: \(score)")
        XCTAssertLessThanOrEqual(score, 90, "Copy was too simple for the requested range. Score: \(score)")
    }

    private func route(
        signedIn: Bool,
        loaded: Bool = false,
        hasOrg: Bool = false,
        connected: Bool = false,
        completed: Bool = false
    ) -> OnboardingRoute {
        OnboardingFlow.route(for: OnboardingSnapshot(
            isSignedIn: signedIn,
            organizationStatusLoaded: loaded,
            hasOrganization: hasOrg,
            organizationConnected: connected,
            setupWasCompleted: completed
        ))
    }

    private func fleschReadingEase(_ text: String) -> Double {
        let sentences = max(1, text.filter { ".!?".contains($0) }.count)
        let words = text
            .lowercased()
            .split { !$0.isLetter }
            .map(String.init)
        let syllables = words.reduce(0) { $0 + syllableCount($1) }
        return 206.835
            - 1.015 * (Double(words.count) / Double(sentences))
            - 84.6 * (Double(syllables) / Double(words.count))
    }

    private func syllableCount(_ word: String) -> Int {
        let known = [
            "github": 2,
            "noxhere": 2,
        ]
        if let count = known[word] { return count }

        let vowels = Set("aeiouy")
        let letters = Array(word)
        var count = 0
        var previousWasVowel = false
        for letter in letters {
            let isVowel = vowels.contains(letter)
            if isVowel && !previousWasVowel { count += 1 }
            previousWasVowel = isVowel
        }
        if word.hasSuffix("e"), count > 1, !word.hasSuffix("le") { count -= 1 }
        return max(1, count)
    }
}
