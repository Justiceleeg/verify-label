import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: [
      "core/**/*.test.ts",
      "fixtures/**/*.test.ts",
      "app/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
