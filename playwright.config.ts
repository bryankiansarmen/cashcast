import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.spec.ts",
  retries: 0, // a test that needs a retry is a flaky test
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    timeout: 240_000, // the build runs first, and is slow on some disks
    reuseExistingServer: true,
  },
});
