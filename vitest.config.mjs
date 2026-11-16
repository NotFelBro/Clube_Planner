
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/setupUserIndexes.mjs"],
    globals: false,
    include: ["tests/**/*.test.mjs"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
