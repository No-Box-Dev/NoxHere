import { compatibilityApiPath } from "./api-paths.js";

export const PRODUCT_APP_IDS = ["planning", "activity", "feedback", "telemetry"];
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
  if (/^\/api\/v1\/projects\/[^/]+\/telemetry(?:\/|$)/.test(pathname)) return "telemetry";
  pathname = compatibilityApiPath(pathname);
  if (/^\/api\/projects\/[^/]+\/activity$/.test(pathname)) return "activity";
  if (/^\/api\/projects\/[^/]+\/issues$/.test(pathname)) return "activity";
  if (/^\/api\/projects\/[^/]+\/incidents$/.test(pathname)) return "telemetry";
  if (/^\/api\/projects\/[^/]+\/incidents\/[^/]+$/.test(pathname)) return "telemetry";
  if (/^\/api\/projects\/[^/]+\/feedback$/.test(pathname)) return "feedback";
  if (/^\/api\/config(?:\/|$)/.test(pathname)) return "noxhere";
  if (/^\/api\/(?:features|specs|assign|issue-state)(?:\/|$)/.test(pathname)) {
    return "planning";
  }
  if (/^\/api\/v1\/activity(?:\/|$)/.test(pathname)
      || /^\/api\/(?:issues|prs|events|engineer-activity|engineer-stats|search|llm-settings|activity)(?:\/|$)/.test(pathname)
      || /^\/api\/github\/(?:comments|details)$/.test(pathname)
      || /^\/api\/projects\/[^/]+\/backfill-prs$/.test(pathname)) {
    return "activity";
  }
  if (/^\/api\/(?:v1\/)?feedback(?:\/|$)/.test(pathname)) return "feedback";
  if (/^\/api\/(?:v1\/)?telemetry(?:\/|$)/.test(pathname)) return "telemetry";
  return null;
}

export function appForDeliverySource(source) {
  if (source === "planning") return "planning";
  if (source === "posts" || source === "release_notes" || source === "activity_daily_summary") return "activity";
  if (source === "feedback") return "feedback";
  if (source === "telemetry") return "telemetry";
  return null;
}

export function appForSlackKind(kind) {
  if (kind === "planning") return "planning";
  if (kind === "activity" || kind === "activity_posts" || kind === "activity_release_notes" || kind === "activity_daily_summary" || kind === "narrative" || kind === "release_notes") {
    return "activity";
  }
  if (kind === "feedback") return "feedback";
  if (kind === "telemetry" || kind === "telemetry_alerts") return "telemetry";
  return null;
}
