import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * The specs run against the app at APP_URL: Better Auth refuses requests from any other origin, so
 * the server must listen on that port. `.dev.vars` wins over wrangler.jsonc, as it does in wrangler.
 */
const appUrl = () => {
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const value = /^APP_URL=["']?([^"'\s]+)/m.exec(vars)?.[1];
  return new URL(value ?? "http://localhost:3000");
};

const url = appUrl();
const port = url.port || "3000";
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "src/features",
  testMatch: "**/e2e/*.spec.ts",
  fullyParallel: true,
  forbidOnly: ci,
  retries: 0,
  use: { baseURL: url.origin, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `vite dev --port ${port} --strictPort`,
    url: url.origin,
    // Locally, reuse `bun run dev` if it is already up; CI always starts a fresh server.
    reuseExistingServer: !ci,
  },
});
