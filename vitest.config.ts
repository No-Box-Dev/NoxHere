import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
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
      "apps/cli/test/**",
    ],
  },
});
