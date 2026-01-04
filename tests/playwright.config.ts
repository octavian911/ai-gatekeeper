import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "artifacts/playwright-report" }],
    ["json", { outputFile: "artifacts/test-results.json" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || "https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "artifacts/test-results",
});
