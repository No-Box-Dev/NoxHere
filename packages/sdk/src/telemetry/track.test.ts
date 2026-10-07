import { describe, expect, it, vi } from "vitest";
import { createNoxCue as createBrowserNoxCue } from "./browser.js";
import { createNoxCue as createServerNoxCue } from "./server.js";

const serverKey = `nox_secret_${"b".repeat(32)}`;
const browserKey = `nox_pub_${"a".repeat(32)}`;
const identityHashKey = "identity-secret-key-that-is-at-least-32-bytes";

const accepted = () => new Response('{"eventId":"stored"}', { status: 202 });

describe("unified telemetry track API", () => {
  it("protects a server identity before serializing the request", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const client = createServerNoxCue({ key: serverKey, identityHashKey, environment: "production", fetch: request });

    await expect(client.track("records.parsed", { userId: "user-42", value: 3 }))
      .resolves.toMatchObject({ ok: true });

    const body = String(request.mock.calls[0]![1]?.body);
    expect(body).not.toContain("user-42");
    expect(JSON.parse(body)).toMatchObject({
      type: "activity.tracked",
      name: "records.parsed",
      value: 3,
      userId: "h1_primary_6fdbBuPK_-WNdWq5PMZJ5I9UF9NYsZ_YYRn2WZxPj40",
    });
  });

  it("fails closed without an identity hashing key", async () => {
    const request = vi.fn<typeof fetch>();
    const client = createServerNoxCue({ key: serverKey, fetch: request });
    await expect(client.track("records.parsed", { userId: "raw-user" }))
      .resolves.toMatchObject({ ok: false, error: "invalid_configuration" });
    expect(request).not.toHaveBeenCalled();
  });

  it("sends an anonymous browser count without storing an identity", async () => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    const client = createBrowserNoxCue({ key: browserKey, fetch: request });
    client.identify({ id: "must-not-leave" });

    await client.track("website.demo_clicked", { value: 2 });

    const body = String(request.mock.calls[0]![1]?.body);
    expect(body).not.toContain("must-not-leave");
    expect(JSON.parse(body)).toMatchObject({
      type: "activity.tracked",
      name: "website.demo_clicked",
      value: 2,
    });
  });

  it("rejects non-website activity from a public key", async () => {
    const request = vi.fn<typeof fetch>();
    const client = createBrowserNoxCue({ key: browserKey, fetch: request });
    await expect(client.track("records.parsed" as "website.demo_clicked"))
      .resolves.toMatchObject({ ok: false, error: "invalid_configuration" });
    expect(request).not.toHaveBeenCalled();
  });
});
