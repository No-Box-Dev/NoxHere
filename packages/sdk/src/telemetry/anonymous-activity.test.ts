import { describe, expect, it, vi } from "vitest";
import { createNoxCue } from "./browser.js";

const key = `nox_pub_${"a".repeat(32)}`;

describe("anonymous browser activity", () => {
  it("does not read or write browser persistence", async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const request = vi.fn<typeof fetch>(async () => new Response('{"eventId":"stored"}', { status: 202 }));
    const client = createNoxCue({ key, fetch: request });

    await client.track("website.page_visited");

    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    const body = String(request.mock.calls[0]![1]?.body);
    expect(body).not.toMatch(/userId|identity|session|fingerprint|cookie/i);
    vi.unstubAllGlobals();
  });
});
