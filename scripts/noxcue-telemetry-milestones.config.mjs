export const activeMilestone = "M8";

export const milestones = [
  {
    id: "M0",
    name: "Baseline and enforced gates",
    objective: "Lock the existing NoxCue SDK and ingest behavior and enforce a fail-closed telemetry roadmap.",
    requiredPaths: [
      "docs/NOXCUE_TELEMETRY_MILESTONES.md",
      "scripts/noxcue-telemetry-milestones.config.mjs",
      "scripts/run-noxcue-telemetry-milestones.mjs",
      "packages/sdk/src/telemetry/telemetry.test.ts",
      "packages/python-sdk/tests/test_telemetry.py",
      "services/cue/src/__tests__/events.test.ts",
    ],
    gates: [
      {
        name: "Milestone engine tests",
        command: "npx",
        args: ["vitest", "run", "scripts/run-platform-milestones.test.js"],
      },
      {
        name: "TypeScript telemetry baseline",
        command: "npm",
        args: ["--prefix", "packages/sdk", "test", "--", "src/telemetry/telemetry.test.ts", "src/telemetry/adapters.test.ts"],
      },
      {
        name: "Python telemetry baseline",
        command: "python3",
        args: ["-m", "unittest", "discover", "-s", "packages/python-sdk/tests", "-p", "test_telemetry.py", "-v"],
      },
      {
        name: "Cue ingest baseline",
        command: "npm",
        args: ["--prefix", "services/cue", "test", "--", "src/__tests__/events.test.ts", "src/__tests__/activity-catalog.test.ts"],
      },
    ],
  },
  {
    id: "M1",
    name: "One track contract",
    objective: "Expose one versioned track() API in TypeScript and Python while preserving compatibility wrappers.",
    requiredPaths: [
      "packages/sdk/src/telemetry/track.test.ts",
      "packages/python-sdk/tests/test_telemetry_track.py",
      "services/cue/packages/sdk-contract/track-wire-fixtures.json",
    ],
    gates: [
      {
        name: "Track contract and cross-language parity",
        command: "npm",
        args: ["--prefix", "services/cue", "run", "sdk:parity"],
      },
    ],
  },
  {
    id: "M2",
    name: "Identity protection before transmission",
    objective: "HMAC-protect every server-side identity before request serialization and reject unsafe configuration locally.",
    requiredPaths: [
      "packages/sdk/src/telemetry/identity.ts",
      "packages/sdk/src/telemetry/identity.test.ts",
      "packages/python-sdk/src/noxhere/telemetry/_identity.py",
      "packages/python-sdk/tests/test_telemetry_identity.py",
    ],
    gates: [
      {
        name: "Identity vectors and wire-level privacy",
        command: "npm",
        args: ["--prefix", "services/cue", "run", "sdk:parity"],
      },
      {
        name: "Cue identity contract enforcement",
        command: "npm",
        args: ["--prefix", "services/cue", "test", "--", "src/__tests__/events.test.ts"],
      },
    ],
  },
  {
    id: "M3",
    name: "Anonymous browser activity and abuse controls",
    objective: "Accept allowlisted count-only browser events without identity or persistent tracking and enforce browser ingest limits.",
    requiredPaths: [
      "packages/sdk/src/telemetry/anonymous-activity.test.ts",
      "services/cue/src/__tests__/anonymous-events.test.ts",
      "functions/api/__tests__/noxcue-browser-security.test.ts",
    ],
    gates: [
      {
        name: "Browser SDK anonymity",
        command: "npm",
        args: ["--prefix", "packages/sdk", "test", "--", "src/telemetry/anonymous-activity.test.ts"],
      },
      {
        name: "Browser ingest security",
        command: "npm",
        args: ["--prefix", "services/cue", "test", "--", "src/__tests__/anonymous-events.test.ts"],
      },
    ],
  },
  {
    id: "M4",
    name: "Source and environment isolation",
    objective: "Scope keys, configuration, schedules, cards, reports, and destinations to independent sources and environments.",
    requiredPaths: [
      "functions/api/__tests__/noxcue-source-isolation.test.ts",
      "services/scheduler/src/__tests__/noxcue-source-isolation.test.ts",
    ],
    gates: [
      {
        name: "Apply migrations to fresh local D1",
        command: "npx",
        args: ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", "{tempDir}/d1", "--config", "workers/api-gateway/wrangler.jsonc", "--env="],
      },
      {
        name: "Source and report isolation",
        command: "npx",
        args: ["vitest", "run", "functions/api/__tests__/noxcue-source-isolation.test.ts", "services/scheduler/src/__tests__/noxcue-source-isolation.test.ts"],
      },
    ],
  },
  {
    id: "M5",
    name: "N1 metrics and report cards",
    objective: "Calculate the agreed user, subscription, activity, conversion, churn, and configurable report-card metrics.",
    requiredPaths: [
      "functions/lib/__tests__/noxcue-n1-metrics.test.ts",
      "services/scheduler/src/__tests__/noxcue-n1-report.test.ts",
    ],
    gates: [
      {
        name: "N1 metric scenarios and report budget",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/noxcue-n1-metrics.test.ts", "services/scheduler/src/__tests__/noxcue-n1-report.test.ts"],
      },
    ],
  },
  {
    id: "M6",
    name: "Privacy retention and governance controls",
    objective: "Enforce and document storage, retention, deletion, access, audit, and aggregate-output policies.",
    requiredPaths: [
      "docs/NOXCUE_DATA_GOVERNANCE.md",
      "docs/noxcue-data-inventory.json",
      "scripts/check-noxcue-data-governance.mjs",
      "functions/api/__tests__/noxcue-data-governance.test.ts",
    ],
    gates: [
      {
        name: "Apply migrations to fresh local D1",
        command: "npx",
        args: ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", "{tempDir}/d1", "--config", "workers/api-gateway/wrangler.jsonc", "--env="],
      },
      {
        name: "Data inventory and documentation drift",
        command: "node",
        args: ["scripts/check-noxcue-data-governance.mjs"],
      },
      {
        name: "Retention deletion access and output policy",
        command: "npx",
        args: ["vitest", "run", "functions/api/__tests__/noxcue-data-governance.test.ts"],
      },
    ],
  },
  {
    id: "M7",
    name: "Ingest-key lifecycle",
    objective: "Complete scoped show-once key creation, usage history, rotation, revocation, and immutable audit behavior.",
    requiredPaths: [
      "functions/api/__tests__/noxcue-key-lifecycle.test.ts",
    ],
    gates: [
      {
        name: "Apply migrations to fresh local D1",
        command: "npx",
        args: ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", "{tempDir}/d1", "--config", "workers/api-gateway/wrangler.jsonc", "--env="],
      },
      {
        name: "Key lifecycle and leakage tests",
        command: "npx",
        args: ["vitest", "run", "functions/api/__tests__/noxcue-key-lifecycle.test.ts"],
      },
    ],
  },
  {
    id: "M8",
    name: "SDK operations and release",
    objective: "Prove non-blocking delivery, retry safety, release integrity, clean installation, and the complete local telemetry path.",
    requiredPaths: [
      "docs/NOXCUE_TELEMETRY_OPERATIONS.md",
      "scripts/noxcue-telemetry-local-e2e.mjs",
      "scripts/verify-sdk-release-artifacts.mjs",
    ],
    gates: [
      {
        name: "SDK generation and drift",
        command: "npm",
        args: ["run", "sdk:check"],
      },
      {
        name: "Complete SDK tests",
        command: "npm",
        args: ["run", "test:sdk"],
      },
      {
        name: "Cue contract build and tests",
        command: "npm",
        args: ["--prefix", "services/cue", "run", "check"],
      },
      {
        name: "Release artifacts provenance and checksums",
        command: "node",
        args: ["scripts/verify-sdk-release-artifacts.mjs"],
      },
      {
        name: "Local identified and anonymous telemetry E2E",
        command: "node",
        args: ["scripts/noxcue-telemetry-local-e2e.mjs"],
      },
    ],
  },
];
