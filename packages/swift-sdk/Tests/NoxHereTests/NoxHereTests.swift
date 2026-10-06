import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import NoxHere

final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let isAttachment = request.url?.path.contains("/attachments/") == true
        let status = isAttachment ? 200 : 412
        let contentType = isAttachment ? "application/octet-stream" : "application/json"
        let data = isAttachment
            ? Data([0x00, 0xff, 0x41])
            : Data(#"{"error":{"code":"revision_conflict","message":"Refresh and retry"}}"#.utf8)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: status, httpVersion: nil,
            headerFields: ["Content-Type": contentType, "X-Request-ID": "request-1"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class NoxHereTests: XCTestCase {
    func testGeneratedCatalogAndRequestEncoding() throws {
        XCTAssertEqual(NoxHereOperations.all.count, NoxHereOperations.operationCount)
        XCTAssertEqual(NoxHereOperations.all["listProjects"]?.resource, .workspace)
        XCTAssertEqual(NoxHereOperations.all["submitPublicNoxSpotReport"]?.servers, ["https://api.noxspot.dev"])

        let client = NoxHereClient(token: "nox_sk_test", organization: "org-1", projectID: "project-1")
        let request = try client.makeRequest(
            operationID: "getProjectIncident",
            path: ["projectId": "project 1", "incidentId": "incident-1"],
            query: ["view": "summary"]
        )
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer nox_sk_test")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Org"), "org-1")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Project-ID"), "project-1")
        XCTAssertTrue(request.url?.absoluteString.contains("project%25201") == false)
        XCTAssertTrue(request.url?.absoluteString.contains("view=summary") == true)
    }

    func testPublicOperationsDoNotReceivePlatformCredentials() throws {
        let client = NoxHereClient(token: "nox_sk_test", organization: "org-1", projectID: "project-1")
        let request = try client.makeRequest(operationID: "getPublicNoxSpotConfig", path: ["siteId": "site-1"])
        XCTAssertEqual(request.url?.host, "api.noxspot.dev")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(request.value(forHTTPHeaderField: "X-Org"))
        XCTAssertNil(request.value(forHTTPHeaderField: "X-Project-ID"))
    }

    func testExplicitBaseURLWinsAndCredentialedHTTPRequiresLoopback() throws {
        let staging = NoxHereClient(baseURL: URL(string: "https://staging.example.test/root")!, token: "secret")
        let publicRequest = try staging.makeRequest(operationID: "getPublicNoxSpotConfig", path: ["siteId": "site-1"])
        XCTAssertEqual(publicRequest.url?.host, "staging.example.test")
        XCTAssertNil(publicRequest.value(forHTTPHeaderField: "Authorization"))

        let insecure = NoxHereClient(baseURL: URL(string: "http://example.test")!, token: "secret")
        XCTAssertThrowsError(try insecure.makeRequest(operationID: "listProjects")) { error in
            XCTAssertEqual((error as? NoxHereAPIError)?.code, "insecure_url")
        }
        XCTAssertNoThrow(try NoxHereClient(baseURL: URL(string: "http://127.0.0.1:8787")!, token: "secret").makeRequest(operationID: "listProjects"))
    }

    func testUnknownOperationFailsBeforeNetwork() {
        XCTAssertThrowsError(try NoxHereClient().makeRequest(operationID: "notAnOperation")) { error in
            XCTAssertEqual((error as? NoxHereAPIError)?.code, "unknown_operation")
        }
    }

    func testAttachmentDataAndNestedAPIErrors() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let client = NoxHereClient(session: URLSession(configuration: configuration))

        let data = try await client.requestData(
            "downloadFeatureAttachment",
            path: ["number": "42", "attachmentId": "attachment-1"]
        )
        XCTAssertEqual(data, Data([0x00, 0xff, 0x41]))

        do {
            _ = try await client.request("listProjects")
            XCTFail("Expected a structured API error")
        } catch let error as NoxHereAPIError {
            XCTAssertEqual(error.code, "revision_conflict")
            XCTAssertEqual(error.message, "Refresh and retry")
            XCTAssertEqual(error.requestID, "request-1")
        }
    }
}
