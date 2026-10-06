import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSdkContract } from "./generate-sdk-contract.mjs";

const openapi = JSON.parse(readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"));
const generated = JSON.parse(readFileSync(new URL("../packages/sdk-contract/public-api.json", import.meta.url), "utf8"));

describe("language-neutral SDK contract", () => {
  it("is an exact deterministic projection of the canonical OpenAPI document", () => {
    expect(generated).toEqual(buildSdkContract(openapi));
    expect(generated.operations).toHaveLength(149);
    expect(new Set(generated.operations.map((operation) => operation.id)).size).toBe(149);
    expect(Object.keys(generated.components.schemas)).toEqual(Object.keys(openapi.components.schemas).sort());
  });

  it("carries safety, authentication, scope, and content metadata for every operation", () => {
    for (const operation of generated.operations) {
      expect(operation.authentication, operation.id).toBeTruthy();
      expect(operation.changeSafety, operation.id).toBeTruthy();
      expect(operation.projectScope, operation.id).toBeTruthy();
      expect(operation.requestContentTypes, operation.id).toBeInstanceOf(Array);
      expect(operation.responseContentTypes, operation.id).toBeInstanceOf(Array);
    }
  });

  it("fails closed for duplicate IDs, unmapped tags, and unresolved schemas", () => {
    const duplicate = structuredClone(openapi);
    const operation = Object.values(duplicate.paths).flatMap((item) => Object.values(item))
      .find((item) => item?.operationId);
    const second = Object.values(duplicate.paths).flatMap((item) => Object.values(item))
      .find((item) => item?.operationId && item !== operation);
    second.operationId = operation.operationId;
    expect(() => buildSdkContract(duplicate)).toThrow(/Duplicate operationId/);

    const unmapped = structuredClone(openapi);
    Object.values(unmapped.paths).flatMap((item) => Object.values(item))
      .find((item) => item?.operationId).tags = ["UnknownProduct"];
    expect(() => buildSdkContract(unmapped)).toThrow(/No SDK namespace/);

    const unresolved = structuredClone(openapi);
    unresolved.components.schemas.Broken = { $ref: "#/components/schemas/DoesNotExist" };
    expect(() => buildSdkContract(unresolved)).toThrow(/Unresolved OpenAPI reference/);
  });
});
