import { afterEach, expect, it, vi } from "vitest";
import { handleMcp, MCP_REQUEST_TIMEOUT_MS, PROTOCOL_VERSION, type McpDependencies } from "./mcp";

function request(signal?: AbortSignal, body?: ReadableStream<Uint8Array>) {
  return new Request("https://example.test/mcp", {
    method: "POST", signal,
    headers: {
      Authorization: "Bearer nox_sk_deadline_fixture_only", "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": "tools/call", "Mcp-Name": "work_list_tasks",
    },
    body: body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "work_list_tasks", _meta: {
        "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    } }),
    ...(body ? { duplex: "half" } : {}),
  });
}
const context = { credentialType: "api_token", projectId: "project-a", orgLogin: "org-a", scopes: ["services:read", "planning:read"] };
function dependencies(): McpDependencies {
  return { authenticate: vi.fn(async () => ({ context })), dispatch: vi.fn(async () => Response.json({ items: [] })), rateLimit: vi.fn(async () => null) };
}
afterEach(() => { vi.useRealTimers(); });

it("bounds authentication even if the dependency ignores cancellation, with no late dispatch", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  let finish!: (value: { context: typeof context }) => void;
  let signal!: AbortSignal;
  deps.authenticate = vi.fn((read: Request) => { signal = read.signal; return new Promise<{ context: typeof context }>((resolve) => { finish = resolve; }); });
  const pending = handleMcp(request(), deps);
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS);
  const response = await pending;
  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", error: { code: -32603, message: "MCP request deadline exceeded." } });
  expect(signal.aborted).toBe(true);
  finish({ context });
  await vi.advanceTimersByTimeAsync(0);
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds a stalled request body without waiting for its cancellation promise", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const deps = dependencies();
  const pending = handleMcp(request(undefined, new ReadableStream({ cancel })), deps);
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS);
  expect((await pending).status).toBe(504);
  expect(cancel).toHaveBeenCalledOnce();
  expect(deps.dispatch).not.toHaveBeenCalled();
});

it("bounds dispatch, propagates abort, and cancels a late response", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  let finish!: (value: Response) => void;
  let signal!: AbortSignal;
  deps.dispatch = vi.fn((read: Request) => { signal = read.signal; return new Promise<Response>((resolve) => { finish = resolve; }); });
  const pending = handleMcp(request(), deps);
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS);
  const response = await pending;
  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 1, error: { code: -32603, message: "MCP request deadline exceeded." } });
  expect(signal.aborted).toBe(true);
  const cancel = vi.fn();
  finish(new Response(new ReadableStream({ cancel })));
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalledOnce();
});

it("bounds a stalled successful upstream response body", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  const cancel = vi.fn();
  deps.dispatch = vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { "Content-Type": "application/json" } }));
  const pending = handleMcp(request(), deps);
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS);
  expect((await pending).status).toBe(504);
  expect(cancel).toHaveBeenCalledOnce();
});

it("does not wait for upstream error-body cancellation", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  deps.dispatch = vi.fn(async () => new Response(new ReadableStream({ cancel: () => new Promise<void>(() => {}) }), { status: 429 }));
  const response = await handleMcp(request(), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ result: { isError: true, structuredContent: { error: { code: "noxhere_http_429" } } } });
  expect(vi.getTimerCount()).toBe(0);
});

it("clears the deadline after a normal response", async () => {
  vi.useFakeTimers();
  expect((await handleMcp(request(), dependencies())).status).toBe(200);
  expect(vi.getTimerCount()).toBe(0);
});

it("shares one deadline across authentication and dispatch instead of resetting it", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  deps.authenticate = vi.fn(() => new Promise<{ context: typeof context }>((resolve) => {
    setTimeout(() => resolve({ context }), 10_000);
  }));
  deps.dispatch = vi.fn(() => new Promise<never>(() => {}));
  const pending = handleMcp(request(), deps);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(deps.dispatch).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS - 10_000);
  expect((await pending).status).toBe(504);
  expect(vi.getTimerCount()).toBe(0);
});

it("honors caller cancellation before authentication", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  controller.abort();
  const deps = dependencies();
  expect((await handleMcp(request(controller.signal), deps)).status).toBe(408);
  expect(deps.authenticate).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("honors caller cancellation during authentication", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const deps = dependencies();
  deps.authenticate = vi.fn(() => new Promise<never>(() => {}));
  const pending = handleMcp(request(controller.signal), deps);
  controller.abort();
  expect((await pending).status).toBe(408);
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds admission checks that ignore cancellation and prevents late authentication", async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  let finish!: (value: Response | null) => void;
  deps.rateLimit = vi.fn(() => new Promise<Response | null>((resolve) => { finish = resolve; }));
  const pending = handleMcp(request(), deps);
  await vi.advanceTimersByTimeAsync(MCP_REQUEST_TIMEOUT_MS);
  expect((await pending).status).toBe(504);
  finish(null);
  await vi.advanceTimersByTimeAsync(0);
  expect(deps.authenticate).not.toHaveBeenCalled();
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
