import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      "apps/web/**",
      "workers/**",
      "services/telemetry/**",
      "services/activity/**",
      "services/gateway/**",
      "services/feedback/**",
      "services/planning/**",
      "packages/sdk/**",
      "packages/feedback-widget/**",
      "apps/cli/test/**",
    ],
  },
});
