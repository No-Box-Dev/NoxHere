import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedErrorCode } from "./bounded-error-code";

const bytes = (text: string) => new TextEncoder().encode(text);
afterEach(() => vi.useRealTimers());

describe("bounded upstream error inspection", () => {
  it("preserves small error codes and the caller's original body", async () => {
    const response = Response.json({ error: { code: "resource_not_found" } }, { status: 404 });
    expect(await boundedErrorCode(response)).toBe("resource_not_found");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "resource_not_found" } });
  });

  it("bounds chunked errors without trusting a missing or understated length", async () => {
    for (const headers of [new Headers(), new Headers({ "Content-Length": "1" })]) {
      let pulls = 0;
      const response = new Response(new ReadableStream<Uint8Array>({
        pull(controller) { pulls++; controller.enqueue(new Uint8Array(8192)); },
      }), { status: 502, headers });
      expect(await boundedErrorCode(response)).toBe("response_too_large");
      // Includes bounded tee prefetch, not an unbounded drain of the source.
      expect(pulls).toBeLessThan(16);
      await response.body!.cancel();
    }
  });

  it("times out a stalled stream without waiting for tee cancellation", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const result = boundedErrorCode(response);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe("unknown");
    await response.body!.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("honors abort during a stalled read", async () => {
    const controller = new AbortController();
    const response = new Response(new ReadableStream());
    const result = boundedErrorCode(response, controller.signal);
    controller.abort();
    expect(await result).toBe("unknown");
    await response.body!.cancel();
  });

  it("does not clone or read an already aborted response", async () => {
    const response = Response.json({ error: { code: "unused" } });
    const clone = vi.spyOn(response, "clone");
    expect(await boundedErrorCode(response, AbortSignal.abort())).toBe("unknown");
    expect(clone).not.toHaveBeenCalled();
  });

  it("returns the safe fallback for errored, malformed and non-code bodies", async () => {
    const response = new Response(new ReadableStream({
      start(controller) { controller.error(new Error("private upstream detail")); },
    }));
    expect(await boundedErrorCode(response)).toBe("unknown");
    for (const body of ["not json", "null", '{"error":{"code":123}}']) {
      expect(await boundedErrorCode(new Response(bytes(body)))).toBe("unknown");
    }
  });
});
