import { LEGACY_NOXTICKET_SOURCE } from "./naming-compat.js";
import { compatibilityApiPath } from "./api-paths.js";

export const PRODUCT_APP_IDS = ["noxticket", "noxfeed", "noxspot", "noxcue"];
const ALWAYS_AVAILABLE = Object.freeze(Object.fromEntries(PRODUCT_APP_IDS.map((appId) => [appId, true])));

export function parseAppSettings(..._ignored) {
  return { ...ALWAYS_AVAILABLE };
}

export async function getEnabledApps(..._ignored) {
  return { ...ALWAYS_AVAILABLE };
}

export async function isAppEnabled(..._ignored) {
  return true;
}

export async function isAppEnabledForOwner(..._ignored) {
  return true;
}

export function appForApiPath(pathname) {
  if (/^\/api\/v1\/projects\/[^/]+\/cue(?:\/|$)/.test(pathname)) return "noxcue";
  pathname = compatibilityApiPath(pathname);
  if (/^\/api\/projects\/[^/]+\/activity$/.test(pathname)) return "noxfeed";
  if (/^\/api\/projects\/[^/]+\/issues$/.test(pathname)) return "noxfeed";
  if (/^\/api\/projects\/[^/]+\/incidents$/.test(pathname)) return "noxcue";
  if (/^\/api\/projects\/[^/]+\/incidents\/[^/]+$/.test(pathname)) return "noxcue";
  if (/^\/api\/projects\/[^/]+\/feedback$/.test(pathname)) return "noxspot";
  if (/^\/api\/config(?:\/|$)/.test(pathname)) return "noxconnect";
  if (/^\/api\/(?:features|specs|assign|issue-state)(?:\/|$)/.test(pathname)) {
    return "noxticket";
  }
  if (/^\/api\/v1\/feed(?:\/|$)/.test(pathname)
      || /^\/api\/(?:issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|noxfeed)(?:\/|$)/.test(pathname)
      || /^\/api\/github\/(?:comments|details)$/.test(pathname)
      || /^\/api\/projects\/[^/]+\/backfill-prs$/.test(pathname)) {
    return "noxfeed";
  }
  if (/^\/api\/spots(?:\/|$)/.test(pathname)) return "noxspot";
  if (/^\/api\/cues(?:\/|$)/.test(pathname)) return "noxcue";
  return null;
}

export function appForDeliverySource(source) {
  if (source === "noxticket" || source === LEGACY_NOXTICKET_SOURCE) return "noxticket";
  if (source === "posts" || source === "release_notes" || source === "noxfeed_daily_summary") return "noxfeed";
  if (source === "noxspot") return "noxspot";
  if (source === "noxcue") return "noxcue";
  return null;
}

export function appForSlackKind(kind) {
  if (kind === "noxticket") return "noxticket";
  if (kind === "noxfeed" || kind === "noxfeed_posts" || kind === "noxfeed_release_notes" || kind === "noxfeed_daily_summary" || kind === "narrative" || kind === "release_notes") {
    return "noxfeed";
  }
  if (kind === "noxspot") return "noxspot";
  if (kind === "noxcue" || kind === "noxcue_alerts") return "noxcue";
  return null;
}
