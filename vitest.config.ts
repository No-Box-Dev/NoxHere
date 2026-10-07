import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      "apps/web/**",
      "workers/**",
      "services/cue/**",
      "services/feed/**",
      "services/gateway/**",
      "services/spot/**",
      "services/ticket/**",
      "packages/sdk/**",
      "packages/feedback-widget/**",
      "apps/cli/test/**",
    ],
  },
});
