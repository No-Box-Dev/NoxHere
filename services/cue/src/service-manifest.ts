export const NOXCUE_SERVICE_MANIFEST = {
  contract: "nox.service-manifest",
  version: 1,
  service: {
    id: "noxcue",
    name: "Incidents",
    kind: "product",
    focus: "Monitor daily customer health",
    description: "Accepts bounded lifecycle and error events, derives health metrics, delivers summaries, and routes incidents into project workflows.",
    requiredConnections: ["slack"],
    optionalConnections: ["github"],
    capabilities: [
      { id: "sources", name: "Event sources", description: "Create sources for lifecycle and application error events.", access: "admin", requires: ["slack"], operations: [
        { id: "list_sources", method: "GET", path: "/api/v1/cues/sources", authentication: "admin", description: "List incident sources." },
        { id: "create_source", method: "POST", path: "/api/v1/cues/sources", authentication: "admin", description: "Create an incident source." },
        { id: "update_source", method: "PUT", path: "/api/v1/cues/sources/{sourceId}", authentication: "admin", description: "Replace one source's configuration." },
        { id: "delete_source", method: "DELETE", path: "/api/v1/cues/sources/{sourceId}", authentication: "admin", description: "Delete a source." },
        { id: "test_source_health", method: "POST", path: "/api/v1/cues/sources/{sourceId}/health/test", authentication: "admin", description: "Test the source's health destination." },
      ] },
      { id: "ingest_keys", name: "Ingest keys", description: "Create and revoke scoped keys used by applications to submit events.", access: "admin", requires: ["slack"], operations: [
        { id: "create_ingest_key", method: "POST", path: "/api/v1/cues/sources/{sourceId}/keys", authentication: "admin", description: "Create a one-time source ingest key." },
        { id: "revoke_ingest_key", method: "DELETE", path: "/api/v1/cues/sources/{sourceId}/keys/{keyId}", authentication: "admin", description: "Revoke an ingest key." },
        { id: "ingest_event", method: "POST", path: "/api/v1/cues/public/events", authentication: "ingest_key", description: "Submit a bounded, idempotent source event." },
      ] },
      { id: "health_metrics", name: "Health metrics", description: "View registrations, active users, errors, and derived daily health history.", access: "admin", requires: ["slack"], operations: [
        { id: "list_cue_events", method: "GET", path: "/api/v1/cues/events", authentication: "admin", description: "List recent normalized events and delivery state." },
        { id: "get_cue_metrics", method: "GET", path: "/api/v1/cues/metrics", authentication: "admin", description: "Read daily customer-health metrics." },
        { id: "get_cue_project_overview", method: "GET", path: "/api/v1/cues/project-overview", authentication: "member", description: "Read the selected project's customer-health overview." },
      ] },
      { id: "github_incidents", name: "GitHub incidents", description: "Route qualifying incidents into the repository linked to each project.", access: "admin", requires: ["github"], operations: [
        { id: "get_cue_github_incident_settings", method: "GET", path: "/api/v1/cues/github-issues", authentication: "admin", description: "Read project incident policy and open incident counts." },
        { id: "put_cue_github_incident_settings", method: "PUT", path: "/api/v1/cues/github-issues", authentication: "admin", description: "Set one project's GitHub incident policy." },
      ] },
      { id: "cue_delivery", name: "Scheduled Slack delivery", description: "Choose the destination, timezone, and local delivery time for each source.", access: "admin", requires: ["slack"], operations: [
        { id: "configure_cue_delivery", method: "PUT", path: "/api/v1/cues/sources/{sourceId}", authentication: "admin", description: "Configure the source digest destination and schedule." },
        { id: "test_cue_route", method: "POST", path: "/api/v1/integrations/slack/test", authentication: "admin", description: "Test the incident Slack route." },
      ] },
    ],
    setupSections: [
      { id: "sources", name: "Sources", capabilityIds: ["sources", "ingest_keys"] },
      { id: "health", name: "Health", capabilityIds: ["health_metrics"] },
      { id: "incidents", name: "GitHub incidents", capabilityIds: ["github_incidents"] },
      { id: "delivery", name: "Delivery", capabilityIds: ["cue_delivery"] },
    ],
  },
  configuration: {
    schemaVersion: 1,
    mode: "resource",
    writable: false,
    writableFields: [],
  },
} as const;
