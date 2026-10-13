import { defineConfig } from "@playwright/test";

// Regenerates the readme screenshots from the production build: `npm run shots`.
export default defineConfig({
  testDir: "tests/shots",
  testMatch: "**/*.shots.ts",
  retries: 0,
  use: {
    baseURL: "http://localhost:4175",
    colorScheme: "light",
    viewport: { width: 1200, height: 900 },
  },
  webServer: {
    command:
      "npx vite build --outDir dist-shots --emptyOutDir && npx vite preview --outDir dist-shots --port 4175 --strictPort",
    url: "http://localhost:4175/",
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
