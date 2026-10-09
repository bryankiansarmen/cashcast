import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    environment: "node",
    setupFiles: ["tests/support/no-network.ts"],
    passWithNoTests: true,
  },
});
