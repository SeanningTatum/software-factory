import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^#\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1", import.meta.url)) },
      {
        find: "cloudflare:workers",
        replacement: fileURLToPath(
          new URL("./src/app/testing/cloudflare-workers.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ["*.test.ts", "src/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      // On only in `bun run test` (`--coverage`): a run of one file can't meet a whole-app floor.
      provider: "v8",
      include: ["src/{app,features}/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "src/gen/**",
        "src/routeTree.gen.ts",
        "**/e2e/**",
        "src/app/testing/**",
      ],
      reporter: ["text-summary"],
      // Floors sit 4 points under 2026-11-24: lines 75.21, functions 63.34, branches 71.22, statements 74.34.
      thresholds: { lines: 71, functions: 59, branches: 67, statements: 70 },
    },
  },
});
