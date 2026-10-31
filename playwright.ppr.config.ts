import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ppr",

  fullyParallel: false,
  workers: 1,
  retries: 0,

  timeout: 60_000,

  expect: {
    timeout: 20_000,
  },

  reporter: [
    ["list"],
    ["html", {
      outputFolder: "playwright-ppr-report",
      open: "never",
    }],
  ],

  outputDir: "test-results-ppr",

  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
  {
    name: "chromium-ppr",
    use: {
      ...devices["Desktop Chrome"],
    },
  },
  {
    name: "chromium-ppr-375",
    use: {
      ...devices["Desktop Chrome"],
      viewport: {
        width: 375,
        height: 812,
      },
    },
  },
  {
    name: "chromium-ppr-320",
    use: {
      ...devices["Desktop Chrome"],
      viewport: {
        width: 320,
        height: 740,
      },
    },
  },
],

  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});