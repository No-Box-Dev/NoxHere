export const NOXCUE_SERVICE_MANIFEST = Object.freeze({
  contract: "nox.service-manifest",
  version: 1,
  service: {
    id: "noxcue",
    name: "NoxCue",
    kind: "product",
    focus: "Monitor daily customer health",
    description: "Accepts bounded customer lifecycle and error events, derives daily health metrics, delivers scheduled summaries to Slack, and can route incidents into project GitHub issues.",
    requiredConnections: ["slack"],
    optionalConnections: ["github"],
    capabilities: [
      { id: "sources", name: "Event sources", description: "Create sources for customer lifecycle and application error events.", access: "admin", requires: ["slack"], operations: [
        { id: "list_sources", method: "GET", path: "/api/cues/sources", authentication: "admin", description: "List NoxCue sources." },
        { id: "create_source", method: "POST", path: "/api/cues/sources", authentication: "admin", description: "Create a NoxCue source." },
        { id: "update_source", method: "PUT", path: "/api/cues/sources/{sourceId}", authentication: "admin", description: "Replace one source's configuration." },
        { id: "delete_source", method: "DELETE", path: "/api/cues/sources/{sourceId}", authentication: "admin", description: "Delete a source." },
      ] },
      { id: "ingest_keys", name: "Ingest keys", description: "Create and revoke scoped keys used by applications to submit events.", access: "admin", requires: ["slack"], operations: [
        { id: "create_ingest_key", method: "POST", path: "/api/cues/sources/{sourceId}/keys", authentication: "admin", description: "Create a one-time source ingest key." },
        { id: "revoke_ingest_key", method: "DELETE", path: "/api/cues/sources/{sourceId}/keys/{keyId}", authentication: "admin", description: "Revoke an ingest key." },
        { id: "ingest_event", method: "POST", path: "/api/cues/public/v1/events", authentication: "ingest_key", description: "Submit a bounded, idempotency-aware source event through the stable NoxConnect gateway." },
      ] },
      { id: "health_metrics", name: "Health metrics", description: "View registrations, active users, errors, and derived daily health history.", access: "admin", requires: ["slack"], operations: [
        { id: "list_cue_events", method: "GET", path: "/api/cues/events", authentication: "admin", description: "List recent normalized events and delivery state." },
        { id: "get_cue_metrics", method: "GET", path: "/api/cues/metrics", authentication: "admin", description: "Read daily customer-health metrics." },
      ] },
      { id: "apple_analytics", name: "App Store Connect analytics", description: "Connect a production source to bounded App Store acquisition, usage, and crash reports.", access: "admin", operations: [
        { id: "get_apple_analytics", method: "GET", path: "/api/cues/sources/{sourceId}/apple", authentication: "admin", description: "Read Apple analytics connection and sync status without exposing credentials." },
        { id: "connect_apple_analytics", method: "PUT", path: "/api/cues/sources/{sourceId}/apple", authentication: "admin", description: "Validate and encrypt an App Store Connect API key." },
        { id: "sync_apple_analytics", method: "POST", path: "/api/cues/sources/{sourceId}/apple/sync", authentication: "admin", description: "Import currently available Apple analytics report batches." },
        { id: "disconnect_apple_analytics", method: "DELETE", path: "/api/cues/sources/{sourceId}/apple", authentication: "admin", description: "Remove the stored Apple credential and stop future imports." },
      ] },
      { id: "github_incidents", name: "GitHub incidents", description: "Route qualifying NoxCue incidents into the GitHub repository linked to each project.", access: "admin", requires: ["github"], operations: [
        { id: "get_cue_github_incident_settings", method: "GET", path: "/api/cues/github-issues", authentication: "admin", description: "List project repository mappings, incident policy, and open incident counts." },
        { id: "put_cue_github_incident_settings", method: "PUT", path: "/api/cues/github-issues", authentication: "admin", description: "Set the environments, repeat policy, and enabled state for one project's GitHub incidents." },
      ] },
      { id: "cue_delivery", name: "Scheduled Slack delivery", description: "Choose the destination, timezone, and local delivery time for each source.", access: "admin", requires: ["slack"], operations: [
        { id: "configure_cue_delivery", method: "PUT", path: "/api/cues/sources/{sourceId}", authentication: "admin", description: "Set timezone, local digest time, workspace, and channel." },
        { id: "test_cue_route", method: "POST", path: "/api/integrations/slack/test", authentication: "admin", description: "Test the noxcue Slack route." },
      ] },
    ],
    setupSections: [
      { id: "sources", name: "Sources", capabilityIds: ["sources", "ingest_keys"] },
      { id: "health", name: "Health", capabilityIds: ["health_metrics", "apple_analytics"] },
      { id: "incidents", name: "GitHub incidents", capabilityIds: ["github_incidents"] },
      { id: "delivery", name: "Delivery", capabilityIds: ["cue_delivery"] },
    ],
  },
  configuration: { schemaVersion: 1, mode: "resource", writable: false, writableFields: [] },
} as const);
