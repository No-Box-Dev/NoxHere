import { createClient, safeErrorDetails } from "./core.js";
import type { BrowserNoxCueClient, BrowserNoxCueOptions } from "./types.js";

export type * from "./types.js";
export { safeErrorDetails };

export function createNoxCue(options: BrowserNoxCueOptions): BrowserNoxCueClient {
  const client = createClient(options, "publishable", {
    kind: "browser",
    currentUrl: () => typeof location === "undefined" ? undefined : location.href,
  });
  if (options.captureUnhandled === true && typeof window !== "undefined") {
    const onError = (event: ErrorEvent) => client.capture(event.error ?? new Error(event.message || "Unhandled browser error"), {
      component: "browser.unhandled", fatal: true, unhandled: true,
    });
    const onRejection = (event: PromiseRejectionEvent) => client.capture(event.reason ?? new Error("Unhandled promise rejection"), {
      component: "browser.unhandled-rejection", fatal: true, unhandled: true,
    });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const close = client.close;
    client.close = () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      close();
    };
  }
  return client;
}
