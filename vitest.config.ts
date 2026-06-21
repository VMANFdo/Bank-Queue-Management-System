import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: "forks",
    singleFork: true,
  },
});
