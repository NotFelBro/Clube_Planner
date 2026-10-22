
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.mjs"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
