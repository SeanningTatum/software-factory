import { fileURLToPath } from "node:url";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [fumadocsMdx()],
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
      // Floors sit 4 points under 2026-11-24: lines 77.81, functions 67.4, branches 72.4, statements 76.69.
      thresholds: { lines: 73, functions: 63, branches: 68, statements: 72 },
    },
  },
});
