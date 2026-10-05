import { describe, expect, it, vi } from "vitest";
import { createNoxHere } from "./client.js";
import { operationDefinitions } from "./operations.generated.js";

describe("@noxhere/sdk", () => {
  it("maps every OpenAPI operation exactly once", () => {
    expect(operationDefinitions).toHaveLength(149);
    expect(new Set(operationDefinitions.map((item) => item.id)).size).toBe(149);
    const client = createNoxHere({ fetch: vi.fn() as typeof fetch });
    expect(Object.keys(client.operations)).toHaveLength(149);
    expect(client.cue).toBe(client.incidents);
    expect(client.spot).toBe(client.feedback);
  });

  it("encodes path/query input and applies unified auth headers", async () => {
    const request = vi.fn(async () => Response.json({ ok: true }));
    const client = createNoxHere({
      baseUrl: "https://example.test/base/",
      token: "nox_sk_test_secret",
      organization: "no-box-dev",
      projectId: "project-1",
      fetch: request as typeof fetch,
    });
    await client.activity.getIssue({ path: { repo: "owner/repo", number: 42 }, query: { include: ["body", "labels"] } });
    const [url, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(String(url)).toBe("https://example.test/api/v1/issues/owner%2Frepo/42?include=body&include=labels");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer nox_sk_test_secret");
    expect(new Headers(init?.headers).get("x-project-id")).toBe("project-1");
  });

  it("serializes JSON and returns structured API errors", async () => {
    const request = vi.fn(async () => Response.json({ error: "denied" }, { status: 403 }));
    const client = createNoxHere({ fetch: request as typeof fetch });
    await expect(client.request("createProject", { body: { name: "Demo" } })).rejects.toMatchObject({
      status: 403,
      operationId: "createProject",
      details: { error: "denied" },
    });
    const [, init] = (request.mock.calls as unknown as [URL, RequestInit][])[0];
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });
});
