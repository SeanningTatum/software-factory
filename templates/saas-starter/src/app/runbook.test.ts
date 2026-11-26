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

describe("migrations", () => {
  it("can't be generated without a name", () => {
    // drizzle-kit stops on a `--name` with no value, so its random names never reach drizzle/.
    const { scripts } = JSON.parse(read("package.json"));
    if (scripts["db:generate"]) expect(scripts["db:generate"]).toMatch(/ --name$/);
  });
});

/** The rulesets name workflow jobs as required checks; a renamed job would block every merge. */
describe("branch rules", () => {
  const workflow = (name: string) => read(`.github/workflows/${name}.yml`);
  const job = (name: string) => new RegExp(`^  ${name}:$`, "m");
  const required = (branch: string): Array<string> =>
    JSON.parse(read(`.github/rulesets/${branch}.json`))
      .rules.find((r: { type: string }) => r.type === "required_status_checks")
      .parameters.required_status_checks.map((c: { context: string }) => c.context);

  it("requires only checks a workflow runs, and the short checks share none of their names", () => {
    const sources = ["ci", "deploy", "title"].map(workflow).join("\n");
    for (const context of [...required("staging"), ...required("production")]) {
      expect(sources).toMatch(job(context));
      expect(workflow("pr")).not.toMatch(job(context));
    }
  });

  it("lets staging move only by a squash whose title was checked", () => {
    const { parameters } = JSON.parse(read(".github/rulesets/staging.json")).rules.find(
      (r: { type: string }) => r.type === "pull_request",
    );
    expect(parameters.allowed_merge_methods).toEqual(["squash"]);
    expect(required("staging")).toContain("title");
    // A fixed title must clear the check without a push.
    expect(workflow("title")).toMatch(/types: \[.*\bedited\b.*\]/);
  });

  it("moves production by fast-forward only, and deploys it only at a tagged commit of staging", () => {
    const { rules } = JSON.parse(read(".github/rulesets/production.json"));
    const types = rules.map((r: { type: string }) => r.type);
    // A merged pull request would give production a commit staging lacks.
    expect(types).not.toContain("pull_request");
    expect(types).toEqual(expect.arrayContaining(["deletion", "non_fast_forward"]));
    expect(workflow("ci")).toMatch(/pull_request:\n\s+branches: \[staging\]/);
    // GitHub counts a skipped job as passed, and timeline skips on the push a promotion starts from.
    expect(required("production")).not.toContain("timeline");
    // A ruleset cannot ask for a tag, so the production job does, before it touches anything.
    expect(workflow("deploy")).toMatch(
      / {2}production:\n[\s\S]*merge-base --is-ancestor HEAD origin\/staging[\s\S]*git tag --points-at HEAD --list 'v\*'[\s\S]*name: Migrate and deploy/,
    );
  });

  it("deploys production only from its branch, after the same commit's staging deploy", () => {
    expect(required("production")).toContain("staging");
    expect(workflow("deploy")).toMatch(
      /production:\n(\s+#.*\n)*\s+if: \$\{\{ github\.ref_name == 'production' && !github\.event\.created/,
    );
  });
});
