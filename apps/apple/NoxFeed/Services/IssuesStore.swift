import Foundation

@MainActor
final class IssuesStore: ObservableObject {
    @Published private(set) var issues: [Issue]
    @Published private(set) var members: [APIClient.OrgMember]
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private var requestGeneration = 0

    init(issues: [Issue] = [], members: [APIClient.OrgMember] = []) {
        self.issues = issues
        self.members = members
    }

    func refresh(client: APIClient, status: IssueStatus, repository: String?) async {
        requestGeneration += 1
        let generation = requestGeneration
        let cold = issues.isEmpty
        if cold { isLoading = true }
        errorMessage = nil
        defer {
            if generation == requestGeneration { isLoading = false }
        }

        do {
            async let issuesRequest = client.fetchIssues(
                state: status.rawValue,
                repository: repository,
                closedSince: status.closedSince
            )
            async let membersRequest = try? client.fetchMembers()
            let (loadedIssues, loadedMembers) = try await (issuesRequest, membersRequest)
            guard generation == requestGeneration else { return }
            issues = loadedIssues
            if let loadedMembers { members = loadedMembers }
        } catch {
            guard generation == requestGeneration else { return }
            if issues.isEmpty { errorMessage = error.userFacingDescription }
        }
    }
}
