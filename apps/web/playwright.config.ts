import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  retries: 0,
  expect: { timeout: 15000 },
  outputDir: "../../artifacts/playwright",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "../../artifacts/playwright-report", open: "never" },
    ],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
