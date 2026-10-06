import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectDirectApiOperations } from "../../../public/direct-api-examples.js";

const document = JSON.parse(readFileSync(resolve("public/openapi.json"), "utf8"));
const operations = collectDirectApiOperations(document);

describe("direct HTTP examples", () => {
  it("builds one curl request for every OpenAPI operation", () => {
    const expected = Object.values(document.paths).reduce((count, pathItem) => (
      count + Object.keys(pathItem).filter((method) => ["get", "post", "put", "patch", "delete"].includes(method)).length
    ), 0);
    expect(operations).toHaveLength(expected);
    expect(operations.length).toBeGreaterThan(100);
  });

  it.each(operations)("keeps $method $path aligned with its OpenAPI operation", ({ path, method, operation, curl }) => {
    const server = operation.servers?.[0]?.url ?? document.servers[0].url;
    expect(curl).toContain(`curl --request ${method}`);
    expect(curl).toContain(server);
    for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
      expect(curl).not.toContain(`/{${name}}`);
      expect(curl).toContain(`\${${name.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}}`);
      expect(curl).toContain(`"${server}`);
    }
    if (operation.requestBody?.content?.["application/json"]) {
      const serialized = curl.match(/--data '([^']+)'/)?.[1];
      expect(serialized).toBeTruthy();
      expect(() => JSON.parse(serialized)).not.toThrow();
    }
  });

  it("uses the credential class declared by OpenAPI", () => {
    const byId = new Map(operations.map((item) => [item.operation.operationId, item.curl]));
    expect(byId.get("listNoxServices")).toContain("Authorization: Bearer $NOXHERE_API_TOKEN");
    expect(byId.get("ingestNoxCueEvent")).toContain("X-Nox-Ingest-Key: $NOXHERE_INGEST_KEY");
    expect(byId.get("getPublicNoxSpotConfig")).not.toContain("Authorization:");
    expect(byId.get("createApiToken")).toContain("Cookie: __Host-nox_session=$NOXHERE_SESSION");
    expect(byId.get("createApiToken")).toContain("X-CSRF-Token: $NOXHERE_CSRF_TOKEN");
  });

  it("uses the OpenAPI multipart field names", () => {
    const byId = new Map(operations.map((item) => [item.operation.operationId, item.curl]));
    expect(byId.get("reopenResolvedNoxSpotReport")).toContain("--form 'response=string'");
    expect(byId.get("reopenResolvedNoxSpotReport")).toContain("--form 'screenshot=@path/to/screenshot'");
    expect(byId.get("uploadFeatureAttachment")).toContain("--form 'file=@path/to/file'");
  });
});
