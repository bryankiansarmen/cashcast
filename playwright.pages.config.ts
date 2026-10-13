import { defineConfig } from "@playwright/test";

// Checks the production build under the GitHub Pages base path. The main e2e suite serves the build at "/".
export default defineConfig({
  testDir: "tests/pages",
  testMatch: "**/*.pages.spec.ts",
  retries: 0,
  use: { baseURL: "http://localhost:4174" },
  webServer: {
    command:
      "npx vite build --outDir dist-pages --emptyOutDir && npx vite preview --outDir dist-pages --port 4174 --strictPort",
    env: { VITE_BASE_PATH: "/cashcast/" },
    url: "http://localhost:4174/cashcast/",
    timeout: 240_000, // the build runs first, and is slow on some disks
    reuseExistingServer: false,
  },
});
