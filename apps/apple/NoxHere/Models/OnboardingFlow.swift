import Foundation

enum OnboardingRoute: Equatable {
    case welcome
    case loadingOrganizations
    case noOrganizations
    case connectOrganization
    case setupComplete
    case feed
}

struct OnboardingSnapshot: Equatable {
    var isSignedIn: Bool
    var organizationStatusLoaded: Bool
    var hasOrganization: Bool
    var organizationConnected: Bool
    var setupWasCompleted: Bool
}

enum OnboardingFlow {
    static func route(for state: OnboardingSnapshot) -> OnboardingRoute {
        guard state.isSignedIn else { return .welcome }
        guard state.organizationStatusLoaded else { return .loadingOrganizations }
        guard state.hasOrganization else { return .noOrganizations }
        guard state.organizationConnected else { return .connectOrganization }
        return state.setupWasCompleted ? .feed : .setupComplete
    }

    static func forcesWelcomePreview(arguments: [String], previewWasCompleted: Bool) -> Bool {
        arguments.contains("--onboarding-preview-welcome") && !previewWasCompleted
    }
}

enum OnboardingCompletionStore {
    private static let keyPrefix = "noxhere.onboarding.completed."

    static func isComplete(login: String, organization: String, defaults: UserDefaults = .standard) -> Bool {
        defaults.bool(forKey: key(login: login, organization: organization))
    }

    static func markComplete(login: String, organization: String, defaults: UserDefaults = .standard) {
        defaults.set(true, forKey: key(login: login, organization: organization))
    }

    private static func key(login: String, organization: String) -> String {
        let scope = "\(login)|\(organization)".lowercased()
        return keyPrefix + Data(scope.utf8).base64EncodedString()
    }
}
