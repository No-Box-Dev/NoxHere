import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The local Cloudflare D1/Pages process is a single launch-like backend.
  // Serial browser flows avoid manufacturing connection failures that do not
  // occur when one user navigates the product.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "npm run dev:backend", url: "http://127.0.0.1:8788/api/health/live", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev", url: "http://127.0.0.1:4180", reuseExistingServer: true },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
