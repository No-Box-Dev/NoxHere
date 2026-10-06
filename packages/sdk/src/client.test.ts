import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createNoxHere } from "./client.js";
import { operationDefinitions } from "./operations.generated.js";

describe("@noxhere/sdk", () => {
  it("maps every OpenAPI operation exactly once", () => {
    expect(operationDefinitions.length).toBeGreaterThan(100);
    expect(new Set(operationDefinitions.map((item) => item.id)).size).toBe(operationDefinitions.length);
    const client = createNoxHere({ fetch: vi.fn() as typeof fetch });
    expect(Object.keys(client.operations)).toHaveLength(operationDefinitions.length);
    expect(client.cue).toBe(client.incidents);
    expect(client.spot).toBe(client.feedback);
  });

  it("exposes exact generated operation inputs, outputs, and namespaces", () => {
    const client = createNoxHere({ fetch: vi.fn() as typeof fetch });
    expectTypeOf(client.activity.getIssue).parameter(0).toMatchTypeOf<{
      path: { repo: string; number: number };
    }>();
    expectTypeOf(client.activity.getIssue).returns.toMatchTypeOf<Promise<Record<string, unknown>>>();

    if (false) {
      // @ts-expect-error Required OpenAPI path parameters cannot be omitted.
      void client.activity.getIssue();
      // @ts-expect-error OpenAPI path parameter names are exact.
      void client.activity.getIssue({ path: { repository: "owner/repo", number: 1 } });
      // @ts-expect-error Activity operations do not leak into the workspace namespace.
      void client.workspace.getIssue({ path: { repo: "owner/repo", number: 1 } });
      // @ts-expect-error Required OpenAPI request bodies cannot be omitted.
      void client.feedback.createNoxSpotSite();
    }
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
