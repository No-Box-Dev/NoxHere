import { describe, expect, it } from "vitest";
import openapi from "../../../public/openapi.json";

const methods = new Set(["get", "post", "put", "patch", "delete"]);

describe("public API documentation contract", () => {
  it("makes project context optional and removes the retired NoxFeed config field", () => {
    expect(openapi.components.parameters.projectContext.required).toBe(false);
    expect(openapi.components.schemas.NoxFeedConfigPatch.properties).not.toHaveProperty("projectScope");
    for (const pathItem of Object.values(openapi.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!methods.has(method)) continue;
        expect((operation as { "x-project-scope"?: string })["x-project-scope"]).not.toBe("required");
      }
    }
  });

  it("only advertises automation tokens with an explicit required scope", () => {
    for (const pathItem of Object.values(openapi.paths)) {
      for (const [method, operationValue] of Object.entries(pathItem)) {
        if (!methods.has(method)) continue;
        const operation = operationValue as { security?: Array<Record<string, unknown>>; "x-automation-scope"?: string };
        const acceptsToken = operation.security?.some((entry) => "noxApiToken" in entry) ?? false;
        expect(Boolean(operation["x-automation-scope"])).toBe(acceptsToken);
      }
    }
  });
});
