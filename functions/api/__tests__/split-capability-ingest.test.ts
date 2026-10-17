import { describe, expect, it, vi } from "vitest";
import { onRequest as ingestGrowth } from "../v1/growth/events";
import { onRequest as ingestUsage } from "../v1/usage/events";

function context(body: unknown) {
  const ingestApiTokenEvent = vi.fn(async () => Response.json({ accepted: true }, { status: 202 }));
  return {
    ingestApiTokenEvent,
    value: {
      env: { TELEMETRY_RESPONSE: { fetch: vi.fn(), ingestApiTokenEvent } },
      request: new Request("https://app.noxhere.com/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      data: { orgId: 7, projectId: "project-1", auth: { type: "api_token", id: "token-1", tokenEnvironment: "production" } },
    },
  };
}

describe("split Growth and Usage ingest", () => {
  it("forwards browser CORS preflights to the Telemetry service", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "https://noxhere.com" } }));
    const response = await ingestGrowth({
      env: { TELEMETRY_RESPONSE: { fetch } },
      request: new Request("https://app.noxhere.com/api/v1/growth/events", {
        method: "OPTIONS",
        headers: { Origin: "https://noxhere.com", "Access-Control-Request-Method": "POST" },
      }),
    } as never);
    expect(response.status).toBe(204);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([ingestGrowth, ingestUsage])("authenticates public ingest before validating its capability payload", async (ingest) => {
    const fetch = vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 }));
    const response = await ingest({
      env: { TELEMETRY_RESPONSE: { fetch } },
      request: new Request("https://app.noxhere.com/api/v1/growth/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    } as never);
    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("accepts acquisition events only on Growth", async () => {
    const growth = context({ type: "activity.tracked", name: "website.signup_clicked" });
    expect((await ingestGrowth(growth.value as never)).status).toBe(202);
    expect(growth.ingestApiTokenEvent).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ capability: "growth" }) }));

    const usage = context({ type: "activity.tracked", name: "website.signup_clicked" });
    expect((await ingestUsage(usage.value as never)).status).toBe(422);
    expect(usage.ingestApiTokenEvent).not.toHaveBeenCalled();
  });

  it("accepts product engagement only on Usage", async () => {
    const usage = context({ type: "activity.tracked", name: "custom.comments.written" });
    expect((await ingestUsage(usage.value as never)).status).toBe(202);
    expect(usage.ingestApiTokenEvent).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ capability: "usage" }) }));

    const growth = context({ type: "activity.tracked", name: "custom.comments.written" });
    expect((await ingestGrowth(growth.value as never)).status).toBe(422);
    expect(growth.ingestApiTokenEvent).not.toHaveBeenCalled();
  });
});
