import { describe, expect, it, vi } from "vitest";
import { createNoxCue as createBrowserNoxCue } from "./browser.js";
import { createNoxCue as createServerNoxCue } from "./server.js";
import { noxCueExpressErrorHandler, withNoxCue, withNoxCuePages } from "./adapters.js";

const browserKey = `nox_pub_${"a".repeat(32)}`;
const serverKey = `nox_secret_${"b".repeat(32)}`;

function accepted(eventId = "stored-event") {
  return new Response(JSON.stringify({ eventId }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@noxcue/sdk", () => {
  it("sends a one-line server-side registered-user event through the stable gateway", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createServerNoxCue({
      key: serverKey,
      environment: "production",
      release: "playnist@abc123",
      fetch: request,
    });

    await expect(noxcue.user.registered("user-42")).resolves.toMatchObject({ ok: true, eventId: "stored-event", status: 202 });
    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("https://app.noxhere.com/api/v1/cues/public/events");
    expect(init?.headers).toMatchObject({ "X-Nox-Ingest-Key": serverKey });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      version: 1,
      type: "user.registered",
      environment: "production",
      userId: "user-42",
      eventId: expect.any(String),
      occurredAt: expect.any(String),
      context: {
        environment: "production",
        release: "playnist@abc123",
        runtime: "server",
        sdkVersion: "0.2.0",
      },
    });
  });

  it("rejects the wrong key kind without making a request", async () => {
    const request = vi.fn<typeof fetch>();
    const noxcue = createBrowserNoxCue({ key: serverKey, environment: "production", fetch: request });

    await expect(noxcue.test()).resolves.toMatchObject({ ok: false, error: "invalid_configuration" });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not expose trusted statistics methods in the browser", () => {
    const noxcue = createBrowserNoxCue({ key: browserKey, environment: "production" });
    expect("user" in noxcue).toBe(false);
    expect("activity" in noxcue).toBe(false);
  });

  it("captures unhandled browser errors by default and detaches cleanly", async () => {
    const browser = new EventTarget();
    const request = vi.fn<typeof fetch>(async () => accepted());
    vi.stubGlobal("window", browser);
    vi.stubGlobal("location", { href: "https://app.example.com/signup?token=private" });
    const noxcue = createBrowserNoxCue({ key: browserKey, fetch: request });

    browser.dispatchEvent(Object.assign(new Event("error"), { error: new Error("render exploded"), message: "render exploded" }));
    browser.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("promise exploded") }));
    await noxcue.flush();
    expect(request).toHaveBeenCalledTimes(2);
    const events = request.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(events.map((event) => event.data.component)).toEqual(["browser.unhandled", "browser.unhandled-rejection"]);
    expect(events[0].context.url).toBe("https://app.example.com/signup");

    noxcue.close();
    browser.dispatchEvent(Object.assign(new Event("error"), { error: new Error("after close") }));
    await noxcue.flush();
    expect(request).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("retries a transient response with the same event identity", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(accepted("stored-after-retry"));
    const noxcue = createServerNoxCue({ key: serverKey, environment: "production", fetch: request });

    const result = await noxcue.activity("custom.journals.added", "user-42");

    expect(result).toMatchObject({ ok: true, eventId: "stored-after-retry" });
    expect(request).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(request.mock.calls[0]![1]?.body));
    const second = JSON.parse(String(request.mock.calls[1]![1]?.body));
    expect(second.eventId).toBe(first.eventId);
  });

  it("redacts sensitive error evidence and automatically adds context", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createServerNoxCue({
      key: serverKey,
      environment: "staging",
      release: "playnist@2026.09.07",
      fetch: request,
    });
    const error = Object.assign(new Error("Signup failed for person@example.com with api_key=private"), {
      code: "AUTH_UPSTREAM",
      status: 503,
    });

    await noxcue.error(error, {
      title: "Signup failed",
      component: "auth",
      fingerprint: "auth/signup/provider",
      url: "https://playnist.com/signup?token=private",
    });

    const event = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(event).toMatchObject({
      type: "error.occurred",
      environment: "staging",
      context: { environment: "staging", release: "playnist@2026.09.07", runtime: "server", sdkVersion: "0.2.0" },
      error: { message: "Signup failed for [redacted-email] with api_key=[redacted]", code: "AUTH_UPSTREAM", status: 503 },
      url: "https://playnist.com/signup",
      data: { component: "auth", fingerprint: "auth/signup/provider" },
    });
    expect(JSON.stringify({ message: event.message, error: event.error, url: event.url })).not.toContain("api_key=private");
    expect(JSON.stringify({ message: event.message, error: event.error, url: event.url })).not.toContain("person@example.com");
  });

  it("preserves a wrapped operation error while reporting it in the background", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createBrowserNoxCue({ key: browserKey, environment: "production", fetch: request });
    const original = Object.assign(new Error("provider unavailable"), { status: 503, code: "AUTH_DOWN" });

    await expect(noxcue.auth.signup(async () => { throw original; })).rejects.toBe(original);
    await noxcue.flush();

    const event = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(event).toMatchObject({
      type: "feature.result",
      feature: "auth.signup",
      outcome: "failure",
      reason: "dependency_unavailable",
      error: { code: "AUTH_DOWN", status: 503 },
    });
  });

  it("returns delivery failure instead of throwing into the app", async () => {
    const request = vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); });
    const noxcue = createBrowserNoxCue({ key: browserKey, environment: "production", fetch: request });

    await expect(noxcue.error(new Error("Signup failed"), { title: "Signup failed" }))
      .resolves.toMatchObject({ ok: false, error: "network_error" });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("lets the source key supply the environment and tracks unawaited delivery", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createServerNoxCue({ key: serverKey, fetch: request });

    noxcue.capture(Object.assign(new Error("database unavailable"), { code: "DB_DOWN" }));
    const results = await noxcue.flush();

    expect(results).toEqual([expect.objectContaining({ ok: true })]);
    const event = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(event.environment).toBeUndefined();
    expect(event.context.environment).toBeUndefined();
    expect(event.data).toMatchObject({
      component: "server.application",
      fingerprint: "error.occurred|server.application|db_down|error",
    });
  });

  it("wraps Fetch handlers and preserves successful, 5xx and thrown outcomes", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createServerNoxCue({ key: serverKey, fetch: request });
    const ok = withNoxCue(noxcue, async () => new Response("ok"));
    const failed = withNoxCue(noxcue, async () => new Response("no", { status: 503 }));
    const original = new Error("handler exploded");
    const thrown = withNoxCue(noxcue, async () => { throw original; });

    await expect(ok(new Request("https://app.example.com/api/users"))).resolves.toMatchObject({ status: 200 });
    await expect(failed(new Request("https://app.example.com/api/users"))).resolves.toMatchObject({ status: 503 });
    await expect(thrown(new Request("https://app.example.com/api/users"))).rejects.toBe(original);
    await noxcue.flush();

    expect(request).toHaveBeenCalledTimes(2);
    const events = request.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(events[0]).toMatchObject({ error: { code: "HTTP_503" }, data: { component: "server.request", unhandled: true } });
    expect(events[1]).toMatchObject({ error: { message: "handler exploded" }, data: { component: "server.request", unhandled: true } });
  });

  it("creates a Cloudflare Pages client from bindings and keeps reports alive", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    let noxcue: ReturnType<typeof createServerNoxCue> | undefined;
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const handler = withNoxCuePages<{ NOXCUE_SERVER_KEY: string }>((context) => {
      noxcue = createServerNoxCue({ key: context.env.NOXCUE_SERVER_KEY, fetch: request });
      return noxcue;
    }, async () => new Response(null, { status: 500 }));

    await handler({
      request: new Request("https://app.example.com/api/save"),
      env: { NOXCUE_SERVER_KEY: serverKey },
      waitUntil,
    });
    expect(waitUntil).toHaveBeenCalledOnce();
    await noxcue?.flush();
  });

  it("provides Express error middleware without consuming the app error", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const noxcue = createServerNoxCue({ key: serverKey, fetch: request });
    const next = vi.fn();
    const error = new Error("express exploded");

    noxCueExpressErrorHandler(noxcue)!(error, { method: "POST", originalUrl: "/signup" }, {}, next);
    expect(next).toHaveBeenCalledWith(error);
    await noxcue.flush();
    expect(request).toHaveBeenCalledOnce();
  });
});
