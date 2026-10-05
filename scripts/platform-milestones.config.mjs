export const activeMilestone = "M7";

export const milestones = [
  {
    id: "M0",
    name: "Baseline and enforced gates",
    objective: "Lock in the current event and transport behavior and prove the milestone runner fails closed.",
    requiredPaths: [
      "docs/PLATFORM_EVENT_MILESTONES.md",
      "scripts/platform-milestones.config.mjs",
      "scripts/run-platform-milestones.mjs",
      "scripts/run-platform-milestones.test.js",
      "functions/lib/connection-capabilities.ts",
      "functions/lib/delivery-outbox.js",
    ],
    gates: [
      {
        name: "Runner syntax",
        command: "node",
        args: ["--check", "scripts/run-platform-milestones.mjs"],
      },
      {
        name: "Runner and current transport contract tests",
        command: "npx",
        args: [
          "vitest",
          "run",
          "scripts/run-platform-milestones.test.js",
          "functions/lib/__tests__/connection-capabilities.test.ts",
          "functions/lib/__tests__/delivery-outbox.test.js",
        ],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M1",
    name: "Unified event envelope",
    objective: "Introduce the neutral PlatformEventV1 envelope, domain catalog, runtime validation, and privacy rules.",
    requiredPaths: [
      "packages/contracts/platform-events.ts",
      "packages/contracts/__tests__/platform-events.test.ts",
      "docs/PLATFORM_EVENT_CATALOG.md",
    ],
    gates: [
      {
        name: "Envelope contract tests",
        command: "npx",
        args: ["vitest", "run", "packages/contracts/__tests__/platform-events.test.ts"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M2",
    name: "Canonical event persistence",
    objective: "Persist events idempotently, enqueue projection work, and recover events that were not queued.",
    requiredPaths: [
      "migrations/0100_platform_events.sql",
      "functions/lib/platform-event-store.ts",
      "functions/lib/__tests__/platform-event-store.test.ts",
    ],
    gates: [
      {
        name: "Apply every migration to fresh local D1",
        command: "npx",
        args: [
          "wrangler",
          "d1",
          "migrations",
          "apply",
          "DB",
          "--local",
          "--persist-to",
          "{tempDir}/d1",
          "--config",
          "workers/api-gateway/wrangler.jsonc",
          "--env=",
        ],
      },
      {
        name: "Event persistence, idempotency, and recovery tests",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/platform-event-store.test.ts"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M3",
    name: "Unified outbound transport",
    objective: "Introduce one transport command, provider-neutral outbox, receipt contract, retry model, and Queue consumer.",
    requiredPaths: [
      "packages/contracts/transport-commands.ts",
      "packages/contracts/__tests__/transport-commands.test.ts",
      "migrations/0101_transport_outbox.sql",
      "functions/lib/transport-outbox.ts",
      "functions/lib/__tests__/transport-outbox.test.ts",
    ],
    gates: [
      {
        name: "Apply every migration to fresh local D1",
        command: "npx",
        args: [
          "wrangler",
          "d1",
          "migrations",
          "apply",
          "DB",
          "--local",
          "--persist-to",
          "{tempDir}/d1",
          "--config",
          "workers/api-gateway/wrangler.jsonc",
          "--env=",
        ],
      },
      {
        name: "Transport contracts and outbox tests",
        command: "npx",
        args: [
          "vitest",
          "run",
          "packages/contracts/__tests__/transport-commands.test.ts",
          "functions/lib/__tests__/transport-outbox.test.ts",
        ],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M4",
    name: "Slack transport cutover",
    objective: "Route every Slack write through the transport command and shared outbox without direct producer inserts.",
    requiredPaths: [
      "functions/lib/transports/slack.ts",
      "functions/lib/__tests__/slack-transport.test.ts",
      "scripts/check-transport-boundaries.mjs",
      "scripts/check-transport-boundaries.test.js",
    ],
    gates: [
      {
        name: "Slack adapter behavior",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/slack-transport.test.ts"],
      },
      {
        name: "No Slack transport bypasses",
        command: "node",
        args: ["scripts/check-transport-boundaries.mjs", "--provider", "slack"],
      },
      {
        name: "Boundary checker tests",
        command: "npx",
        args: ["vitest", "run", "scripts/check-transport-boundaries.test.js"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M5",
    name: "GitHub transport cutover",
    objective: "Route outbound GitHub mutations through the same command, outbox, retry, and receipt lifecycle.",
    requiredPaths: [
      "functions/lib/transports/github.ts",
      "functions/lib/__tests__/github-transport.test.ts",
      "migrations/0103_transport_callbacks.sql",
      "scripts/check-transport-boundaries.mjs",
      "scripts/check-transport-boundaries.test.js",
    ],
    gates: [
      {
        name: "Apply every migration to fresh local D1",
        command: "npx",
        args: [
          "wrangler", "d1", "migrations", "apply", "DB", "--local",
          "--persist-to", "{tempDir}/d1", "--config", "workers/api-gateway/wrangler.jsonc", "--env=",
        ],
      },
      {
        name: "GitHub adapter behavior",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/github-transport.test.ts"],
      },
      {
        name: "No GitHub mutation bypasses",
        command: "node",
        args: ["scripts/check-transport-boundaries.mjs", "--provider", "github"],
      },
      {
        name: "Boundary checker tests",
        command: "npx",
        args: ["vitest", "run", "scripts/check-transport-boundaries.test.js"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M6",
    name: "Projections, replay, and delivery events",
    objective: "Project canonical events into activity, reliability, engagement, and feedback models with safe replay.",
    requiredPaths: [
      "functions/lib/platform-event-projector.ts",
      "functions/lib/__tests__/platform-event-projector.test.ts",
      "migrations/0104_platform_event_projections.sql",
      "functions/lib/transport-delivery-events.ts",
      "scripts/replay-platform-events.mjs",
      "scripts/replay-platform-events.test.js",
    ],
    gates: [
      {
        name: "Apply every migration to fresh local D1",
        command: "npx",
        args: [
          "wrangler", "d1", "migrations", "apply", "DB", "--local",
          "--persist-to", "{tempDir}/d1", "--config", "workers/api-gateway/wrangler.jsonc", "--env=",
        ],
      },
      {
        name: "Projection idempotency and out-of-order tests",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/platform-event-projector.test.ts", "functions/lib/__tests__/transport-delivery-events.test.ts"],
      },
      {
        name: "Replay safety tests",
        command: "npx",
        args: ["vitest", "run", "scripts/replay-platform-events.test.js"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
    ],
  },
  {
    id: "M7",
    name: "End-to-end cutover",
    objective: "Prove the unified event and transport path locally, preserve compatibility adapters, and remove direct writes.",
    requiredPaths: [
      "scripts/platform-events-local-e2e.mjs",
      "docs/PLATFORM_EVENT_OPERATIONS.md",
    ],
    gates: [
      {
        name: "Full unit and integration suite",
        command: "npm",
        args: ["test"],
      },
      {
        name: "Functions typecheck",
        command: "npm",
        args: ["run", "typecheck:functions"],
      },
      {
        name: "Lint",
        command: "npm",
        args: ["run", "lint"],
      },
      {
        name: "Unified event and transport local E2E",
        command: "node",
        args: ["scripts/platform-events-local-e2e.mjs"],
      },
    ],
  },
];
