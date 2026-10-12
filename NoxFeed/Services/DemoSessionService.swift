import Foundation

struct DemoSession: Decodable, Hashable {
    struct Identity: Decodable, Hashable {
        let login: String
        let avatarUrl: String?

        enum CodingKeys: String, CodingKey {
            case login
            case avatarUrl = "avatar_url"
        }
    }

    struct Organization: Decodable, Hashable {
        let login: String
    }

    let accessToken: String
    let account: Identity
    let organization: Organization

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case account, organization
    }
}

enum DemoSessionService {
    static func start(
        baseURL: URL = Config.demoAPIBase,
        session: URLSession = .shared
    ) async throws -> DemoSession {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/demo/session"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.status((response as? HTTPURLResponse)?.statusCode ?? 500, nil)
        }
        do { return try JSONDecoder().decode(DemoSession.self, from: data) }
        catch { throw APIError.decoding(error) }
    }
}
