export const INTEGRATION_DISCOVERY_LINK = '</openapi.json>; rel="service-desc", </docs/ai-setup.md>; rel="describedby"';

export const SLACK_ROUTING_BODY_SCHEMA = {
  type: "object",
  required: ["routes"],
  properties: {
    routes: {
      type: "object",
      additionalProperties: false,
      properties: {
        fallback: { type: ["string", "null"] },
        telemetry: { type: ["string", "null"] },
        planning: { type: ["string", "null"] },
        activity_posts: { type: ["string", "null"] },
        activity_release_notes: { type: ["string", "null"] },
        activity_daily_summary: { type: ["string", "null"] },
      },
    },
  },
} as const;
