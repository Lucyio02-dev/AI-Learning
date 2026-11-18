import { defineConfig, devices } from "@playwright/test";

const staticUrl = "http://127.0.0.1:4173";
const distUrl = "http://127.0.0.1:4174";
const fullUrl = "http://127.0.0.1:8788";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "static",
      testIgnore: /(?:full-|dist-).*\.spec\.js/,
      use: { baseURL: staticUrl },
    },
    {
      name: "dist",
      testMatch: /dist-.*\.spec\.js/,
      use: { baseURL: distUrl },
    },
    {
      name: "full",
      testMatch: /full-.*\.spec\.js/,
      use: { baseURL: fullUrl },
    },
  ],
  webServer: [
    {
      command: "node scripts/serve.mjs",
      url: `${staticUrl}/`,
      env: { PORT: "4173", AI_LEARNING_STATIC_ROOT: "" },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/dist-server.mjs",
      url: `${distUrl}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "node e2e/full-server.mjs",
      url: `${fullUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
