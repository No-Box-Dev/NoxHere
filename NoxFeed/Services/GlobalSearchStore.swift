import Foundation

@MainActor
final class GlobalSearchStore: ObservableObject {
    @Published private(set) var results: [GlobalSearchResult] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private struct CacheEntry {
        let insertedAt: Date
        let results: [GlobalSearchResult]
    }

    private var cache: [String: CacheEntry] = [:]
    private let cacheLifetime: TimeInterval = 30

    func search(query rawQuery: String, client: APIClient) async {
        let query = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            results = []
            errorMessage = nil
            isLoading = false
            return
        }

        let key = query.lowercased()
        if let cached = cache[key], Date().timeIntervalSince(cached.insertedAt) < cacheLifetime {
            results = cached.results
            errorMessage = nil
            isLoading = false
            return
        }

        // Mirrors native search fields: typing feels immediate, while the
        // short pause avoids issuing a request for every intermediate letter.
        try? await Task.sleep(for: .milliseconds(200))
        guard !Task.isCancelled else { return }

        isLoading = true
        errorMessage = nil
        do {
            let response = try await client.fetchGlobalSearch(query: query)
            guard !Task.isCancelled else { return }
            cache[key] = CacheEntry(insertedAt: Date(), results: response.results)
            results = response.results
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            errorMessage = error.userFacingDescription
        }
        isLoading = false
    }

    func resetScope() {
        cache.removeAll()
        results = []
        errorMessage = nil
        isLoading = false
    }
}
