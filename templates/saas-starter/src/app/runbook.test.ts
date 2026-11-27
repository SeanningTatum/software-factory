import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const noGithub = !existsSync(".github");

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

  it.skipIf(noGithub)("alerts when the production smoke test fails, before it rolls back", () => {
    const deploy = read(".github/workflows/deploy.yml");
    expect(deploy).toMatch(/ALERT_WEBHOOK_URL: \$\{\{ secrets\.ALERT_WEBHOOK_URL \}\}/);
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
  it("ends db:generate with --name, which drizzle-kit refuses without a value", () => {
    const { scripts } = JSON.parse(read("package.json"));
    if (scripts["db:generate"]) expect(scripts["db:generate"]).toMatch(/ --name$/);
  });
});

describe.skipIf(noGithub)("branch rules", () => {
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

  it("lets staging move only by a squash whose title was checked, again on each edit", () => {
    const { parameters } = JSON.parse(read(".github/rulesets/staging.json")).rules.find(
      (r: { type: string }) => r.type === "pull_request",
    );
    expect(parameters.allowed_merge_methods).toEqual(["squash"]);
    expect(required("staging")).toContain("title");
    expect(workflow("title")).toMatch(/types: \[.*\bedited\b.*\]/);
  });

  it("moves production by fast-forward only, and deploys it only at a tagged commit of staging", () => {
    const { rules } = JSON.parse(read(".github/rulesets/production.json"));
    const types = rules.map((r: { type: string }) => r.type);
    expect(types).not.toContain("pull_request");
    expect(types).toEqual(expect.arrayContaining(["deletion", "non_fast_forward"]));
    expect(workflow("ci")).toMatch(/pull_request:\n\s+branches: \[staging\]/);
    expect(required("production")).not.toContain("timeline");
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

  it("promotes by one unforced push, then starts the deploy that push cannot", () => {
    const promote = workflow("promote");
    expect(promote).toMatch(
      /git push --atomic origin "HEAD:refs\/tags\/\$TAG" HEAD:refs\/heads\/production/,
    );
    expect(promote).not.toMatch(/^\s*git push.*(--force|-f\b)/m);
    expect(promote).toMatch(/gh workflow run deploy\.yml --ref production/);
    expect(workflow("deploy")).toMatch(/^ {2}workflow_dispatch:$/m);
  });

  it("gives a promoted tag a GitHub release, only after the production smoke test has passed", () => {
    const deploy = workflow("deploy");
    expect(deploy).toMatch(
      / {2}production:\n[\s\S]*permissions:\n\s+contents: write[\s\S]*name: Smoke test, rolling back on failure[\s\S]*name: Give the new version its share[\s\S]*gh release view "\$TAG" >\/dev\/null 2>&1 \|\| gh release create "\$TAG" --verify-tag --generate-notes/,
    );
    expect(deploy).not.toMatch(/\b(always|failure|cancelled)\(\)/);
  });

  it("keeps the production job's write token from the packages it installs", () => {
    expect(workflow("deploy")).toMatch(
      / {2}production:\n[\s\S]*contents: write[\s\S]*persist-credentials: false[\s\S]*bun install/,
    );
  });
});

describe("gradual rollout", () => {
  const workflow = (name: string) => read(`.github/workflows/${name}.yml`);

  it("gives the Worker its version in both environments, which the smoke test reads back", () => {
    expect(
      read("wrangler.jsonc").match(/"version_metadata": \{ "binding": "CF_VERSION_METADATA" \}/g),
    ).toHaveLength(2);
  });

  it.skipIf(noGithub)("checks the percent, then passes the button's choice to the deploy", () => {
    expect(workflow("promote")).toMatch(
      /gh workflow run deploy\.yml --ref production -f rollout="\$ROLLOUT" -f percent="\$PERCENT"/,
    );
    expect(workflow("promote")).toMatch(/case \$PERCENT in[\s\S]*exit 1[\s\S]*git push --atomic/);
    expect(workflow("deploy")).toMatch(
      /workflow_dispatch:\n\s+inputs:\n\s+rollout:[\s\S]*options: \[full, gradual\]/,
    );
  });

  it.skipIf(noGithub)(
    "refuses one on workers.dev or over a running one, before it migrates",
    () => {
      expect(workflow("deploy")).toMatch(
        /name: Check a gradual rollout can start[\s\S]*\*\.workers\.dev[\s\S]*'\.versions \| length'[\s\S]*name: Migrate and deploy/,
      );
    },
  );

  it.skipIf(noGithub)(
    "smoke-tests the new version by id with no visitors on it, then shares traffic",
    () => {
      expect(workflow("deploy")).toMatch(
        /versions deploy "\$new@0" "\$OLD@100"[\s\S]*name: Smoke test[\s\S]*Cloudflare-Workers-Version-Overrides: \$NAME=[\s\S]*'\.version\.id'[\s\S]*versions deploy "\$OLD@100"[\s\S]*name: Give the new version its share/,
      );
    },
  );

  it.skipIf(noGithub)("moves the share under the production deploy's lock and environment", () => {
    const rollout = workflow("rollout");
    expect(workflow("deploy")).toMatch(/^concurrency: deploy-\$\{\{ github\.ref_name \}\}$/m);
    expect(rollout).toMatch(/^concurrency: deploy-production$/m);
    expect(rollout).toMatch(/^ {4}environment: production$/m);
    expect(rollout).toMatch(/"back out"\) bunx wrangler versions deploy "\$old@100"/);
    expect(rollout).toMatch(/jq 'length' <<<"\$pair"\)" != 2 \][\s\S]*case \$TO in/);
  });

  it.skipIf(noGithub)(
    "reports each step to the run's summary, and to PostHog when it has the key",
    () => {
      for (const name of ["deploy", "rollout"]) {
        expect(workflow(name)).toContain("sh .github/scripts/report-rollout.sh");
      }
      const report = read(".github/scripts/report-rollout.sh");
      expect(report).toMatch(/GITHUB_STEP_SUMMARY/);
      expect(report).toMatch(
        /\[ -n "\$\{POSTHOG_KEY:-\}" \] \|\| exit 0[\s\S]*deployment_rolled_out/,
      );
    },
  );
});
