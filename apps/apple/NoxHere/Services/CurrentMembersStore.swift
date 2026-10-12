import Foundation

/// Owns the organization-member snapshot shown by CurrentView.
///
/// Opening the popover, changing workspaces, polling, and manually refreshing
/// can all request this data at nearly the same time. This store coalesces
/// duplicate work and uses a generation guard so an older response can never
/// overwrite a newer workspace or a newer successful refresh.
@MainActor
final class CurrentMembersStore: ObservableObject {
    struct Scope: Equatable, Sendable {
        let login: String?
        let org: String?
    }

    struct Operations {
        let members: () async throws -> [APIClient.OrgMember]
        let stats: () async throws -> APIClient.EngineerStats
        let excludedMembers: () async throws -> Set<String>
    }

    @Published private(set) var members: [APIClient.OrgMember] = []
    @Published private(set) var stats: APIClient.EngineerStats?
    @Published private(set) var excludedMembers: Set<String> = []
    @Published private(set) var errorMessage: String?
    @Published private(set) var isLoading = false
    @Published private(set) var hasLoaded = false

    private var scope: Scope?
    private var generation = 0
    private var inFlight: Task<Void, Never>?

    func load(client: APIClient, scope: Scope) async {
        await load(
            scope: scope,
            operations: Operations(
                members: { try await client.fetchMembers() },
                stats: { try await client.fetchEngineerStats() },
                excludedMembers: {
                    client.excludedMembers(from: try await client.fetchSettings())
                }
            )
        )
    }

    /// Internal injection point used by regression tests and previews.
    func load(scope newScope: Scope, operations: Operations) async {
        if scope == newScope, let inFlight {
            await inFlight.value
            return
        }

        if scope != newScope {
            generation &+= 1
            inFlight?.cancel()
            scope = newScope
            members = []
            stats = nil
            excludedMembers = []
            errorMessage = nil
            hasLoaded = false
        }

        generation &+= 1
        let requestGeneration = generation
        isLoading = members.isEmpty
        errorMessage = nil

        let task = Task { [weak self] in
            guard let self else { return }
            async let membersResult = self.captureWithRetry(operations.members)
            async let statsResult = self.captureWithRetry(operations.stats)
            async let exclusionsResult = self.captureWithRetry(operations.excludedMembers)
            let results = await (membersResult, statsResult, exclusionsResult)
            self.apply(
                results,
                scope: newScope,
                generation: requestGeneration
            )
        }
        inFlight = task
        await task.value
        if requestGeneration == generation { inFlight = nil }
    }

    private func apply(
        _ results: (
            Result<[APIClient.OrgMember], Error>,
            Result<APIClient.EngineerStats, Error>,
            Result<Set<String>, Error>
        ),
        scope expectedScope: Scope,
        generation expectedGeneration: Int
    ) {
        guard scope == expectedScope, generation == expectedGeneration else { return }
        isLoading = false
        hasLoaded = true

        var failures: [String] = []
        switch results.0 {
        case .success(let value): members = value
        case .failure(let error): failures.append("Members: \(error.userFacingDescription)")
        }
        switch results.1 {
        case .success(let value): stats = value
        case .failure(let error): failures.append("Counts: \(error.userFacingDescription)")
        }
        switch results.2 {
        case .success(let value): excludedMembers = value
        case .failure(let error): failures.append("Preferences: \(error.userFacingDescription)")
        }
        errorMessage = failures.isEmpty ? nil : failures.joined(separator: " ")
    }

    private func captureWithRetry<Value>(
        _ operation: () async throws -> Value
    ) async -> Result<Value, Error> {
        do {
            return .success(try await operation())
        } catch {
            guard Self.isRetryable(error), !Task.isCancelled else { return .failure(error) }
            do {
                try await Task.sleep(for: .milliseconds(250))
                try Task.checkCancellation()
                return .success(try await operation())
            } catch {
                return .failure(error)
            }
        }
    }

    static func isRetryable(_ error: Error) -> Bool {
        switch error {
        case APIError.network:
            return true
        case APIError.status(let status, _):
            return status == 408 || status == 425 || status == 429 || (500...599).contains(status)
        default:
            return false
        }
    }
}
