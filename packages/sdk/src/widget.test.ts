import { afterEach, describe, expect, it, vi } from "vitest";
import { installNoxHereWidget } from "./widget.js";

describe("widget installer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the site-specific script and passes explicit reporter identity", async () => {
    const identify = vi.fn();
    const script = { dataset: {}, remove: vi.fn() } as unknown as HTMLScriptElement;
    const windowObject: Window & typeof globalThis = { NoxSpot: undefined } as Window & typeof globalThis;
    const appendChild = vi.fn((value: HTMLScriptElement) => {
      windowObject.NoxSpot = { identify };
      value.onload?.(new Event("load"));
      return value;
    });
    vi.stubGlobal("window", windowObject);
    vi.stubGlobal("document", {
      createElement: vi.fn(() => script),
      head: { appendChild },
    });

    const reporter = { name: "Ada", email: "ada@example.com", notifyOnResolution: true };
    const widget = await installNoxHereWidget({ siteId: "site 1", reporter, timeoutMs: 250 });

    expect(script.src).toBe("https://api.noxspot.dev/widget/site%201.js");
    expect(script.async).toBe(true);
    expect(identify).toHaveBeenCalledWith(reporter);
    expect(widget).toBe(windowObject.NoxSpot);
  });

  it("reuses an existing widget and rejects insecure remote hosts", async () => {
    const identify = vi.fn();
    vi.stubGlobal("window", { NoxSpot: { identify } });
    vi.stubGlobal("document", {});
    await expect(installNoxHereWidget({ siteId: "site-1", reporter: null })).resolves.toMatchObject({ identify });
    expect(identify).toHaveBeenCalledWith(null);

    vi.stubGlobal("window", {});
    await expect(installNoxHereWidget({ siteId: "site-1", baseUrl: "http://example.com" })).rejects.toThrow(/HTTPS/);
  });
});
