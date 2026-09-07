import { createClient, safeErrorDetails } from "./core.js";
import type { BrowserNoxCueClient, NoxCueOptions } from "./types.js";

export type * from "./types.js";
export { safeErrorDetails };

export function createNoxCue(options: NoxCueOptions): BrowserNoxCueClient {
  return createClient(options, "publishable", {
    kind: "browser",
    currentUrl: () => typeof location === "undefined" ? undefined : location.href,
  });
}
