export const activeMilestone = "M8";

export const milestones = [
  {
    id: "M0",
    name: "Production login baseline",
    objective: "Keep browser and native login contracts executable before changing authentication infrastructure.",
    requiredPaths: [
      "docs/LOGIN_HARDENING_MILESTONES.md",
      "scripts/login-hardening-milestones.config.mjs",
      "scripts/run-login-hardening-milestones.mjs",
      "services/gateway/src/control/auth.test.ts",
      "apps/web/src/app/App.test.tsx",
    ],
    gates: [
      {
        name: "Gateway authentication contract",
        command: "npm",
        args: ["--prefix", "services/gateway", "test", "--", "src/control/auth.test.ts"],
      },
      {
        name: "Application login and bootstrap behavior",
        command: "npm",
        args: ["--prefix", "apps/web", "test", "--", "--run", "src/app/App.test.tsx"],
      },
    ],
  },
  {
    id: "M1",
    name: "Provider ingress ownership",
    objective: "Keep OAuth and provider ingress on the connections boundary and verify its readiness contract.",
    requiredPaths: [
      "services/connections/src/provider-ingress.ts",
      "services/connections/src/provider-ingress.test.ts",
      "scripts/check-worker-secrets.mjs",
    ],
    gates: [
      {
        name: "Provider ingress behavior",
        command: "npx",
        args: ["vitest", "run", "services/connections/src/provider-ingress.test.ts"],
      },
      {
        name: "Gateway provider boundary",
        command: "npm",
        args: ["--prefix", "services/gateway", "test", "--", "src/index.test.ts"],
      },
    ],
  },
  {
    id: "M2",
    name: "Required organization and project scope",
    objective: "Reject ambiguous authenticated requests and preserve exact organization and project scope through the gateway.",
    requiredPaths: [
      "functions/lib/api-auth.js",
      "functions/lib/__tests__/api-auth.test.ts",
      "functions/_middleware.js",
      "functions/api/__tests__/v1-middleware-errors.test.js",
    ],
    gates: [
      {
        name: "Gateway and core authorization scope",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/api-auth.test.ts", "functions/api/__tests__/v1-middleware-errors.test.js"],
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
    name: "Unified authenticated bootstrap",
    objective: "Load actor, organization, projects, and connection summaries through one scoped, no-store API call.",
    requiredPaths: [
      "functions/api/v1/bootstrap.ts",
      "functions/lib/app-bootstrap.ts",
      "functions/lib/__tests__/app-bootstrap.test.ts",
      "apps/web/src/api/platform.members.test.ts",
    ],
    gates: [
      {
        name: "Bootstrap authorization and response contract",
        command: "npx",
        args: ["vitest", "run", "functions/lib/__tests__/app-bootstrap.test.ts", "functions/lib/__tests__/api-auth.test.ts", "functions/api/__tests__/integration-connections.test.js", "functions/api/__tests__/client-api-parity.test.js", "functions/api/__tests__/openapi-routes.test.js"],
      },
      {
        name: "Web bootstrap integration",
        command: "npm",
        args: ["--prefix", "apps/web", "test", "--", "--run", "src/api/platform.members.test.ts", "src/app/App.test.tsx"],
      },
      {
        name: "Web and functions typecheck",
        command: "npm",
        args: ["run", "login:milestones:typecheck"],
      },
      {
        name: "OpenAPI and generated SDK drift",
        command: "npm",
        args: ["run", "sdk:check"],
      },
    ],
  },
  {
    id: "M4",
    name: "Generated routes and configuration",
    objective: "Generate deployment routes and service configuration from one validated manifest.",
    requiredPaths: [
      "config/platform-services.mjs",
      "config/platform-services.generated.json",
      "scripts/generated-service-manifest.mjs",
      "scripts/generated-service-manifest.test.js",
      "services/gateway/src/generated/platform-service-manifest.ts",
      "services/gateway/src/generated/platform-service-manifest.test.ts",
    ],
    gates: [
      {
        name: "Generated configuration drift",
        command: "npm",
        args: ["run", "routes:check"],
      },
      {
        name: "Manifest validation and routing behavior",
        command: "npx",
        args: ["vitest", "run", "scripts/generated-service-manifest.test.js", "services/gateway/src/generated/platform-service-manifest.test.ts"],
      },
      {
        name: "Gateway route integration",
        command: "npm",
        args: ["--prefix", "services/gateway", "test", "--", "src/index.test.ts", "src/generated/platform-service-manifest.test.ts"],
      },
      {
        name: "Gateway typecheck and build",
        command: "npm",
        args: ["run", "login:milestones:gateway-check"],
      },
    ],
  },
  {
    id: "M5",
    name: "Production-shaped acceptance",
    objective: "Exercise login, bootstrap, organization switching, and API-token scope against staging before promotion.",
    requiredPaths: [
      "scripts/login-staging-acceptance.mjs",
      "scripts/login-staging-acceptance.test.js",
      ".github/workflows/deploy-pages.yml",
    ],
    gates: [
      {
        name: "Staging login acceptance safety and scope",
        command: "npx",
        args: ["vitest", "run", "scripts/login-staging-acceptance.test.js"],
      },
      {
        name: "Private login/bootstrap routing contract",
        command: "node",
        args: ["scripts/login-staging-acceptance.mjs", "--contract"],
      },
    ],
  },
  {
    id: "M6",
    name: "Safe promotion and rollback",
    objective: "Require a verified staging release and retain a tested rollback target before production promotion.",
    requiredPaths: [
      "scripts/promote-verified-release.mjs",
      "scripts/promote-verified-release.test.js",
      ".github/workflows/deploy-pages.yml",
    ],
    gates: [
      { name: "Promotion workflow contract", command: "node", args: ["scripts/promote-verified-release.mjs", "--check"] },
      { name: "Promotion receipt and rollback behavior", command: "npx", args: ["vitest", "run", "scripts/promote-verified-release.test.js"] },
    ],
  },
  {
    id: "M7",
    name: "Split liveness and readiness",
    objective: "Distinguish process liveness from dependency readiness across every deployed service.",
    requiredPaths: [
      "packages/contracts/health.ts",
      "packages/contracts/health.test.ts",
      "functions/api/health/contracts.ts",
      "scripts/check-health-contracts.mjs",
      "scripts/check-health-contracts.test.js",
      "services/activity/src/health.test.js",
      "services/planning/src/__tests__/health.test.ts",
      "services/telemetry/src/__tests__/health.test.ts",
      ".github/workflows/deploy-pages.yml",
    ],
    gates: [
      { name: "Health contract coverage", command: "node", args: ["scripts/check-health-contracts.mjs"] },
      {
        name: "Shared and boundary health behavior",
        command: "npx",
        args: ["vitest", "run", "packages/contracts/health.test.ts", "scripts/check-health-contracts.test.js", "functions/api/__tests__/health.test.ts", "services/connections/src/provider-ingress.test.ts", "services/scheduler/src/__tests__/index.test.js", "scripts/promote-verified-release.test.js"],
      },
      { name: "Gateway health aggregation", command: "npm", args: ["--prefix", "services/gateway", "test", "--", "src/index.test.ts"] },
      { name: "Telemetry health behavior", command: "npm", args: ["--prefix", "services/telemetry", "test", "--", "src/__tests__/health.test.ts"] },
      { name: "Activity health behavior", command: "npm", args: ["--prefix", "services/activity", "test", "--", "src/health.test.js"] },
      { name: "Planning health behavior", command: "npm", args: ["--prefix", "services/planning", "test", "--", "src/__tests__/health.test.ts"] },
      { name: "Feedback health behavior", command: "npm", args: ["--prefix", "services/feedback", "test", "--", "src/index.test.ts"] },
      { name: "Health contract type safety", command: "npm", args: ["run", "login:milestones:typecheck"] },
      { name: "Gateway health build", command: "npm", args: ["run", "login:milestones:gateway-check"] },
    ],
  },
  {
    id: "M8",
    name: "Bounded retry and quarantine",
    objective: "Bound authentication and provider retries, quarantine poison work, and expose actionable recovery state.",
    requiredPaths: [
      "scripts/check-retry-quarantine.mjs",
      "scripts/check-retry-quarantine.test.js",
      "migrations/0118_task_quarantine.sql",
      "functions/lib/task-quarantine.js",
      "functions/lib/__tests__/task-quarantine.test.js",
    ],
    gates: [
      { name: "Retry and quarantine policy", command: "node", args: ["scripts/check-retry-quarantine.mjs"] },
      {
        name: "Quarantine and recovery behavior",
        command: "npx",
        args: ["vitest", "run", "scripts/check-retry-quarantine.test.js", "functions/lib/__tests__/task-quarantine.test.js", "functions/api/__tests__/op-failures.test.js", "services/scheduler/src/__tests__/queue.test.js", "packages/sdk/src/client.test.ts"],
      },
      { name: "Unified SDK retry bounds", command: "npm", args: ["run", "test:sdk"] },
      { name: "M8 functions typecheck", command: "npm", args: ["run", "typecheck:functions"] },
      { name: "M8 API and SDK drift", command: "npm", args: ["run", "sdk:check"] },
    ],
  },
];
