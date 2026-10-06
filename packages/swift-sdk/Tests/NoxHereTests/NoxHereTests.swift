import XCTest
@testable import NoxHere

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
        XCTAssertTrue(request.url?.absoluteString.contains("project%25201") == false)
        XCTAssertTrue(request.url?.absoluteString.contains("view=summary") == true)
    }

    func testUnknownOperationFailsBeforeNetwork() {
        XCTAssertThrowsError(try NoxHereClient().makeRequest(operationID: "notAnOperation")) { error in
            XCTAssertEqual((error as? NoxHereAPIError)?.code, "unknown_operation")
        }
    }
}
