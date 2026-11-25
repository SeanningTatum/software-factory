import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The runbook promises logs, an export and two alerts. This fails when the config behind them is gone. */
const read = (path: string) => readFileSync(path, "utf8");

describe("runbook config", () => {
  it("keeps Workers Logs on and marks the Worker for Logpush", () => {
    const wrangler = read("wrangler.jsonc");
    expect(wrangler).toMatch(/^\s*"observability":\s*\{\s*"enabled":\s*true/m);
    expect(wrangler).toMatch(/^\s*"logpush":\s*true/m);
  });

  it("declares the alert webhook secret", () => {
    const feature = JSON.parse(read("src/features/core/observability/feature.json"));
    expect(feature.secrets).toHaveProperty("ALERT_WEBHOOK_URL");
  });

  it("posts to the webhook when the production smoke test fails", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expect(deploy).toMatch(/ALERT_WEBHOOK_URL: \$\{\{ secrets\.ALERT_WEBHOOK_URL \}\}/);
    // The alert goes before the rollback, so a failed rollback still alerts.
    expect(deploy).toMatch(/"\$ALERT_WEBHOOK_URL"[\s\S]*wrangler rollback/);
  });

  it("documents the export and the alerts", () => {
    const runbook = read("docs/runbook.md");
    for (const text of ["workers_trace_events", "Keep logs past a week", "ALERT_WEBHOOK_URL"]) {
      expect(runbook).toContain(text);
    }
  });
});
