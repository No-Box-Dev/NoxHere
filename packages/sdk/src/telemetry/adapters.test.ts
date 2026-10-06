import { describe, expect, it, vi } from "vitest";
import { createNoxCue, withNoxCue } from "./server.js";

describe("telemetry framework adapters", () => {
  it("reports 5xx responses without changing them", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response('{"eventId":"stored"}', { status: 202 }));
    const client = createNoxCue({ key: `nox_secret_${"a".repeat(32)}`, fetch: request });
    const expected = new Response("failed", { status: 503 });
    const handler = withNoxCue(client, async () => expected, { component: "api.checkout" });

    await expect(handler(new Request("https://example.com/checkout?token=secret"))).resolves.toBe(expected);
    await client.flush();
    const event = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(event).toMatchObject({ type: "error.occurred", data: { component: "api.checkout" } });
    expect(event.title).toBe("GET request failed");
    expect(event.url).toBeUndefined();
    expect(event.data.attributes.route).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});
