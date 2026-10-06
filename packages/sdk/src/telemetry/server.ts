import { createClient, safeErrorDetails } from "./core.js";
import type { NoxCueOptions, ServerNoxCueClient } from "./types.js";

export type * from "./types.js";
export { safeErrorDetails };
export { noxCueExpressErrorHandler, withNoxCue, withNoxCuePages } from "./adapters.js";

function runtime(): "server" | "edge" {
  return typeof navigator !== "undefined" && /Cloudflare-Workers/i.test(navigator.userAgent) ? "edge" : "server";
}

export function createNoxCue(options: NoxCueOptions): ServerNoxCueClient {
  return createClient(options, "secret", { kind: runtime() });
}
