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
  },
});
