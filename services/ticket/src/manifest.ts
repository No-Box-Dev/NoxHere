export const NOXTICKET_MANIFEST = {
  contract: "nox.service-manifest",
  version: 1,
  service: {
    id: "noxticket",
    name: "NoxTicket",
    kind: "product",
    focus: "Plan and organize delivery work",
    description: "Keeps a feature board with a configurable workflow and product specs attached to the work they explain.",
    requiredConnections: [],
    optionalConnections: ["slack"],
    capabilities: [
      { id: "features", name: "Features", description: "Create, update, close, and organize a project's features.", access: "member", operations: [
        { id: "list_features", method: "GET", path: "/api/features", authentication: "member", description: "List the project's features." },
        { id: "create_feature", method: "POST", path: "/api/features", authentication: "member", description: "Create a feature." },
        { id: "update_feature", method: "PATCH", path: "/api/features/{number}", authentication: "member", description: "Update, move, close, or reopen a feature." },
      ] },
      { id: "tasks", name: "Tasks", description: "Manage small personal tasks independently or attached to features.", access: "member", operations: [
        { id: "list_tasks", method: "GET", path: "/api/tasks", authentication: "member", description: "List project tasks." },
        { id: "create_task", method: "POST", path: "/api/tasks", authentication: "member", description: "Create a general or feature-linked task." },
        { id: "update_task", method: "PATCH", path: "/api/tasks/{id}", authentication: "member", description: "Update or complete a task." },
        { id: "delete_task", method: "DELETE", path: "/api/tasks/{id}", authentication: "member", description: "Delete a task." },
      ] },
      { id: "workflow", name: "Workflow", description: "Define the stages used by the feature board.", access: "admin", operations: [
        { id: "get_ticket_config", method: "GET", path: "/api/v1/services/noxticket/config", authentication: "member", description: "Read the feature repository and workflow stages." },
        { id: "patch_ticket_config", method: "PATCH", path: "/api/v1/services/noxticket/config", authentication: "admin", description: "Update the feature repository or workflow stages with If-Match." },
      ] },
      { id: "specs", name: "Specs", description: "Create, link, archive, restore, and attach documents to specs.", access: "member", operations: [
        { id: "list_specs", method: "GET", path: "/api/specs", authentication: "member", description: "List specs in the organization." },
        { id: "get_spec", method: "GET", path: "/api/specs/{id}", authentication: "member", description: "Read one spec." },
        { id: "create_spec", method: "POST", path: "/api/specs", authentication: "member", description: "Create a spec." },
        { id: "update_spec", method: "PATCH", path: "/api/specs/{id}", authentication: "member", description: "Update a spec." },
        { id: "archive_spec", method: "POST", path: "/api/specs/{id}/archive", authentication: "member", description: "Archive a spec." },
        { id: "restore_spec", method: "DELETE", path: "/api/specs/{id}/archive", authentication: "member", description: "Restore a spec." },
      ] },
      { id: "ticket_delivery", name: "Delivery", description: "Prepare NoxTicket activity messages for NoxConnect delivery.", access: "admin", requires: ["slack"], operations: [
        { id: "test_ticket_delivery", method: "POST", path: "/api/integrations/slack/test", authentication: "admin", description: "Test the NoxTicket Slack route." },
      ] },
    ],
    setupSections: [
      { id: "workflow", name: "Workflow", capabilityIds: ["features", "tasks", "workflow"] },
      { id: "storage", name: "Storage", capabilityIds: ["specs"] },
      { id: "delivery", name: "Delivery", capabilityIds: ["ticket_delivery"] },
    ],
  },
  configuration: {
    schemaVersion: 1,
    mode: "service",
    writable: true,
    writableFields: ["featureRepository", "workflow.stages"],
  },
} as const;
