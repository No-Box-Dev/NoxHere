export const NOXFEED_SERVICE_MANIFEST = Object.freeze({
  contract: "nox.service-manifest",
  version: 1,
  service: {
    id: "noxfeed",
    name: "NoxFeed",
    kind: "product",
    focus: "Understand and communicate current work",
    description: "Combines GitHub issues, pull requests, engineering activity, narratives, and release notes into one team feed.",
    requiredConnections: ["github"],
    optionalConnections: ["slack"],
    capabilities: [
      { id: "current_work", name: "Current work", description: "See active pull requests, reviews, and issues across tracked repositories.", access: "member", requires: ["github"], operations: [
        { id: "get_feed", method: "GET", path: "/api/v1/feed", authentication: "member", description: "Read the normalized current-work feed." },
        { id: "list_issues", method: "GET", path: "/api/issues", authentication: "member", description: "List tracked GitHub issues." },
        { id: "get_issue", method: "GET", path: "/api/issues/{repo}/{number}", authentication: "member", description: "Read one tracked issue." },
        { id: "list_pull_requests", method: "GET", path: "/api/prs", authentication: "member", description: "List tracked pull requests." },
        { id: "get_pull_request", method: "GET", path: "/api/prs/{repo}/{number}", authentication: "member", description: "Read one tracked pull request." },
        { id: "close_pull_request", method: "POST", path: "/api/prs/close", authentication: "admin", description: "Close a pull request through GitHub." },
      ] },
      { id: "activity", name: "Engineering activity", description: "Browse normalized project and engineer activity over time.", access: "member", requires: ["github"], operations: [
        { id: "get_engineer_activity", method: "GET", path: "/api/engineer-activity", authentication: "member", description: "Read one engineer's normalized monthly activity." },
      ] },
      { id: "narratives", name: "Posts and release notes", description: "Create readable engineering updates and release narratives from GitHub events.", access: "admin", requires: ["github"], operations: [
        { id: "get_feed_narratives", method: "GET", path: "/api/v1/feed", authentication: "member", description: "Read generated posts and release notes." },
        { id: "patch_feed_config", method: "PATCH", path: "/api/v1/services/noxfeed/config", authentication: "admin", description: "Update the release-notes prompt with If-Match." },
        { id: "put_ai_settings", method: "PUT", path: "/api/llm-settings", authentication: "admin", description: "Choose the organization AI execution mode." },
      ] },
      { id: "feed_delivery", name: "Slack delivery", description: "Route posts and release notes to separate Slack destinations.", access: "admin", requires: ["github", "slack"], operations: [
        { id: "patch_feed_routes", method: "PATCH", path: "/api/integrations/slack/routing", authentication: "admin", description: "Set separate posts and release-notes routes." },
        { id: "test_feed_route", method: "POST", path: "/api/integrations/slack/test", authentication: "admin", description: "Test a NoxFeed Slack route." },
      ] },
    ],
    setupSections: [
      { id: "feed", name: "Feed", capabilityIds: ["current_work", "activity"] },
      { id: "narration", name: "Narration", capabilityIds: ["narratives"] },
      { id: "delivery", name: "Delivery", capabilityIds: ["feed_delivery"] },
    ],
  },
  configuration: {
    schemaVersion: 1,
    mode: "service",
    writable: true,
    writableFields: ["releaseNotesPrompt"],
  },
});

export function validateNoxFeedConfigPatch(current, value) {
  if (!plainObject(current) || !plainObject(value)) return invalid("Config and patch must be objects");
  const unknown = Object.keys(value).filter((key) => !["releaseNotesPrompt"].includes(key));
  if (unknown.length) return invalid(`Unknown fields: ${unknown.join(", ")}`);
  if (Object.hasOwn(value, "releaseNotesPrompt") && value.releaseNotesPrompt !== null &&
      (typeof value.releaseNotesPrompt !== "string" || value.releaseNotesPrompt.length > 20_000)) {
    return invalid("releaseNotesPrompt must be null or at most 20000 characters");
  }
  const patch = {
    ...(Object.hasOwn(value, "releaseNotesPrompt") ? { releaseNotesPrompt: value.releaseNotesPrompt } : {}),
  };
  return {
    contract: "nox.service-config-validation",
    version: 1,
    valid: true,
    patch,
    config: { ...current, ...patch },
  };
}

function plainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function invalid(message) {
  return { contract: "nox.service-config-validation", version: 1, valid: false, issues: [{ message }] };
}
