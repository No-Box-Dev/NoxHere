import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../cues/public/v1/events";

describe("NoxCue public gateway security", () => {
  it("preserves origin and ingest headers while delegating policy to Cue", async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.headers.get("Origin")).toBe("https://n1.care");
      expect(request.headers.get("X-Nox-Ingest-Key")).toMatch(/^nox_pub_/);
      return Response.json({ accepted: true }, { status: 202 });
    });
    const response = await onRequest({
      env: { NOXCUE_RESPONSE: { fetch } as unknown as Fetcher },
      request: new Request("https://app.noxhere.com/api/v1/cues/public/events", {
        method: "POST",
        headers: { Origin: "https://n1.care", "Content-Type": "application/json", "X-Nox-Ingest-Key": `nox_pub_${"a".repeat(43)}` },
        body: JSON.stringify({ type: "activity.tracked" }),
      }),
    });
    expect(response.status).toBe(202);
  });

  it("returns a bounded retry response when Cue is unavailable", async () => {
    const response = await onRequest({
      env: {},
      request: new Request("https://app.noxhere.com/api/v1/cues/public/events", { method: "POST", body: "{}" }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
