import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum JSONValue: Codable, Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

public struct NoxHereAPIError: Error, Sendable, Equatable {
    public let status: Int
    public let code: String
    public let message: String
    public let requestID: String?
}

public struct NoxHereClient: Sendable {
    public let baseURL: URL
    public let token: String?
    public let organization: String?
    public let projectID: String?
    public let timeout: TimeInterval
    public let maxRetries: Int
    private let session: URLSession

    public init(
        baseURL: URL = URL(string: "https://app.noxhere.com")!,
        token: String? = nil,
        organization: String? = nil,
        projectID: String? = nil,
        timeout: TimeInterval = 10,
        maxRetries: Int = 2,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.token = token
        self.organization = organization
        self.projectID = projectID
        self.timeout = min(60, max(0.25, timeout))
        self.maxRetries = min(3, max(0, maxRetries))
        self.session = session
    }

    public func makeRequest(
        operationID: String,
        path: [String: String] = [:],
        query: [String: String] = [:],
        body: JSONValue? = nil,
        headers: [String: String] = [:]
    ) throws -> URLRequest {
        guard let operation = NoxHereOperations.all[operationID] else {
            throw NoxHereAPIError(status: 0, code: "unknown_operation", message: "Unknown operation: \(operationID)", requestID: nil)
        }
        var resolvedPath = operation.path
        let pathSegmentAllowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        for (key, value) in path {
            resolvedPath = resolvedPath.replacingOccurrences(of: "{\(key)}", with: value.addingPercentEncoding(withAllowedCharacters: pathSegmentAllowed) ?? value)
        }
        guard !resolvedPath.contains("{") else {
            throw NoxHereAPIError(status: 0, code: "missing_path_parameter", message: "A required path parameter is missing", requestID: nil)
        }
        let server = operation.servers.first.flatMap(URL.init(string:)) ?? baseURL
        guard var components = URLComponents(url: server, resolvingAgainstBaseURL: false) else {
            throw NoxHereAPIError(status: 0, code: "invalid_url", message: "Could not build request URL", requestID: nil)
        }
        let basePath = components.percentEncodedPath.hasSuffix("/") ? String(components.percentEncodedPath.dropLast()) : components.percentEncodedPath
        components.percentEncodedPath = basePath + (resolvedPath.hasPrefix("/") ? resolvedPath : "/\(resolvedPath)")
        if !query.isEmpty {
            components.queryItems = query.sorted(by: { $0.key < $1.key }).map(URLQueryItem.init)
        }
        guard let url = components.url else {
            throw NoxHereAPIError(status: 0, code: "invalid_url", message: "Could not build request URL", requestID: nil)
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = operation.method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("swift/0.2.0", forHTTPHeaderField: "X-NoxHere-SDK")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let organization { request.setValue(organization, forHTTPHeaderField: "X-NoxHere-Organization") }
        if let projectID { request.setValue(projectID, forHTTPHeaderField: "X-NoxHere-Project") }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    public func request(
        _ operationID: String,
        path: [String: String] = [:],
        query: [String: String] = [:],
        body: JSONValue? = nil,
        headers: [String: String] = [:]
    ) async throws -> JSONValue {
        let request = try makeRequest(operationID: operationID, path: path, query: query, body: body, headers: headers)
        guard let operation = NoxHereOperations.all[operationID] else { preconditionFailure("makeRequest validates operation") }
        let attempts = operation.changeSafety == .safeRead ? maxRetries + 1 : 1
        var lastError: Error?
        for attempt in 0..<attempts {
            do {
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw NoxHereAPIError(status: 0, code: "invalid_response", message: "Expected an HTTP response", requestID: nil)
                }
                if (200..<300).contains(http.statusCode) {
                    return data.isEmpty ? .null : try JSONDecoder().decode(JSONValue.self, from: data)
                }
                let error = Self.apiError(status: http.statusCode, data: data, requestID: http.value(forHTTPHeaderField: "X-Request-ID"))
                if attempt + 1 == attempts || !(http.statusCode == 408 || http.statusCode == 429 || http.statusCode >= 500) { throw error }
                lastError = error
            } catch {
                if error is NoxHereAPIError || attempt + 1 == attempts { throw error }
                lastError = error
            }
            try await Task.sleep(nanoseconds: UInt64(200_000_000 * (1 << attempt)))
        }
        throw lastError ?? NoxHereAPIError(status: 0, code: "transport_error", message: "Request failed", requestID: nil)
    }

    private static func apiError(status: Int, data: Data, requestID: String?) -> NoxHereAPIError {
        let value = (try? JSONDecoder().decode(JSONValue.self, from: data))
        if case .object(let object) = value {
            let code = object["code"].stringValue ?? "http_\(status)"
            let message = object["message"].stringValue ?? object["error"].stringValue ?? "HTTP \(status)"
            return .init(status: status, code: code, message: message, requestID: object["requestId"].stringValue ?? requestID)
        }
        return .init(status: status, code: "http_\(status)", message: "HTTP \(status)", requestID: requestID)
    }
}

private extension Optional where Wrapped == JSONValue {
    var stringValue: String? {
        guard case .string(let value) = self else { return nil }
        return value
    }
}
