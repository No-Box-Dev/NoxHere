import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../feedback/public/v1/resolution/[token]";
import { onRequestPost } from "../feedback/public/v1/resolution-responses/[token]";

function service() {
  return { fetch: vi.fn(async (request: Request) => new Response(new URL(request.url).pathname)) };
}

describe("Feedback public resolution proxy", () => {
  it("serves the resolution page on the NoxHere domain", async () => {
    const binding = service();
    const response = await onRequestGet({
      request: new Request("https://app.noxhere.com/api/feedback/public/v1/resolution/token_123"),
      env: { FEEDBACK_RESPONSE: binding },
      params: { token: "token_123" },
    } as never);

    expect(await response.text()).toBe("/resolution/token_123");
    expect(binding.fetch).toHaveBeenCalledOnce();
  });

  it("passes the response form to Feedback through its private binding", async () => {
    const binding = service();
    const response = await onRequestPost({
      request: new Request("https://app.noxhere.com/api/feedback/public/v1/resolution-responses/token_123", {
        method: "POST",
        body: new FormData(),
      }),
      env: { FEEDBACK_RESPONSE: binding },
      params: { token: "token_123" },
    } as never);

    expect(await response.text()).toBe("/api/feedback/public/v1/resolution-responses/token_123");
    const forwarded = binding.fetch.mock.calls[0][0];
    expect(forwarded.method).toBe("POST");
  });
});
