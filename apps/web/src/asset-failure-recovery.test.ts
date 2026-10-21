import { describe, expect, it, vi } from "vitest";
import { assetFailureRecovery, installAssetFailureRecovery } from "./asset-failure-recovery";

describe("asset failure recovery", () => {
  it("reloads once when Vite reports a stale lazy-loaded module", () => {
    const reload = vi.fn();
    const dispose = installAssetFailureRecovery({ target: window, storage: sessionStorage, reload, now: () => 1_000 });
    const first = new Event("vite:preloadError", { cancelable: true });
    const second = new Event("vite:preloadError", { cancelable: true });

    window.dispatchEvent(first);
    window.dispatchEvent(second);

    expect(first.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(assetFailureRecovery.key)).toBe("1000");
    dispose();
    sessionStorage.clear();
  });

  it("allows recovery again after the loop-protection window", () => {
    const reload = vi.fn();
    sessionStorage.setItem(assetFailureRecovery.key, "1000");
    const dispose = installAssetFailureRecovery({
      target: window,
      storage: sessionStorage,
      reload,
      now: () => 1_000 + assetFailureRecovery.windowMs + 1,
    });

    window.dispatchEvent(new ErrorEvent("error", { message: "Importing a module script failed." }));

    expect(reload).toHaveBeenCalledOnce();
    dispose();
    sessionStorage.clear();
  });

  it("recovers Safari module-import failures reported as rejected promises", () => {
    const reload = vi.fn();
    const dispose = installAssetFailureRecovery({ target: window, storage: sessionStorage, reload, now: () => 2_000 });
    const rejection = new Event("unhandledrejection", { cancelable: true });
    Object.defineProperty(rejection, "reason", { value: new TypeError("Importing a module script failed.") });

    window.dispatchEvent(rejection);

    expect(rejection.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    dispose();
    sessionStorage.clear();
  });
});
