import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.unit.test.ts"],
    environment: "node",
    setupFiles: ["tests/support/no-network.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/budget/**"],
      exclude: ["**/index.ts", "**/types.ts"],
      thresholds: { lines: 95 },
    },
  },
});
