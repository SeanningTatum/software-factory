import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { unstable_readConfig } from "wrangler";

const read = (path: string) => readFileSync(path, "utf8");
const noGithub = !existsSync(".github");
// The workflow scripts need jq, which a GitHub runner has and an older macOS does not.
const noJq = spawnSync("sh", ["-c", "command -v jq"]).status !== 0;
const noBun = spawnSync("sh", ["-c", "command -v bun"]).status !== 0;

describe("runbook config", () => {
  it("marks the Worker for Logpush", () => {
    expect(read("wrangler.jsonc")).toMatch(/^\s*"logpush":\s*true/m);
  });

  it("keeps every log line and whole traces: one in ten in production, all in staging", () => {
    // Without an env name wrangler reads CLOUDFLARE_ENV, which would make "production" staging.
    vi.stubEnv("CLOUDFLARE_ENV", undefined);
    const observability = (env?: string) =>
      unstable_readConfig({ config: "wrangler.jsonc", env }).observability;
    const production = observability();
    const staging = observability("staging");
    for (const config of [production, staging]) {
      expect(config).toMatchObject({
        enabled: true,
        redact_query_string: true,
        traces: { enabled: true },
        issues: { enabled: true },
      });
      expect(config?.head_sampling_rate ?? 1).toBe(1);
      expect(config?.logs?.head_sampling_rate ?? 1).toBe(1);
    }
    expect(production?.traces?.head_sampling_rate).toBe(0.1);
    expect(staging?.traces?.head_sampling_rate).toBe(1);
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

  it.skipIf(noGithub)(
    "gives GitHub each environment's URL, so a deploy or a rollout step links to the live site",
    () => {
      const deploy = read(".github/workflows/deploy.yml");
      const production =
        /^ {4}environment:\n {6}name: production\n {6}url: \$\{\{ vars\.PRODUCTION_URL \}\}$/m;
      expect(deploy).toMatch(
        /^ {4}environment:\n {6}name: staging\n {6}url: \$\{\{ vars\.STAGING_URL \}\}$/m,
      );
      expect(deploy).toMatch(production);
      expect(read(".github/workflows/rollout.yml")).toMatch(production);
    },
  );

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

  it.skipIf(noGithub)("names the restore point before production's migrations run", () => {
    expect(read(".github/workflows/deploy.yml")).toMatch(
      /time-travel restore DB --timestamp=\$\(date \+%s\)[^\n]*GITHUB_STEP_SUMMARY"\n\s+bun run db:migrate:remote/,
    );
    expect(read("docs/runbook.md")).toContain("d1 time-travel restore DB --timestamp=");
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
    const [before = "", after = ""] = workflow("deploy").split(
      "      - name: Create the GitHub release\n",
    );
    const [release = ""] = after.split("\n      - ");
    expect(before).toMatch(
      / {2}production:\n[\s\S]*permissions:\n\s+contents: write[\s\S]*name: Smoke test, rolling back on failure[\s\S]*name: Give the new version its share/,
    );
    expect(release).toMatch(/if gh release view "\$TAG" >\/dev\/null 2>&1; then exit 0; fi/);
    expect(release).toMatch(/gh release create "\$TAG" --verify-tag --generate-notes/);
    expect(release).not.toMatch(/^\s+(if|continue-on-error):/m);
  });

  it("starts the notes at the last release, and warns when it cannot make one", () => {
    expect(workflow("deploy")).toMatch(
      /last=\$\(gh release list --exclude-drafts --limit 1 [^\n]*\) \|\| true\n[\s\S]*--generate-notes \$\{last:\+--notes-start-tag "\$last"\} \|\|\n\s+echo "::warning::/,
    );
  });

  it("checks each URL against its APP_URL before the tag and before the migrations", () => {
    const check = (env: string) =>
      `sh \\.github/scripts/check-app-url\\.sh ${env} "\\$\\{\\{ vars\\.${env.toUpperCase()}_URL \\}\\}"`;
    expect(workflow("promote")).toMatch(new RegExp(`${check("production")}[\\s\\S]*git push`));
    expect(workflow("deploy")).toMatch(
      new RegExp(
        ` {2}staging:\\n[\\s\\S]*${check("staging")}[\\s\\S]*name: Migrate and deploy[\\s\\S]* {2}production:\\n[\\s\\S]*${check("production")}[\\s\\S]*name: Migrate and deploy`,
      ),
    );
    expect(workflow("deploy").match(/\*'APP_URL \(not this origin\)'\*\)/g)).toHaveLength(2);
    expect(read("docs/branches.md")).toMatch(
      /## Move to your own domain\n[\s\S]*create-tanstack-cf-saas setup --env production --var APP_URL=/,
    );
  });

  it.skipIf(noBun)("refuses a URL that is not the environment's APP_URL, naming both", () => {
    const dir = mkdtempSync(join(tmpdir(), "app-url-"));
    writeFileSync(
      join(dir, "wrangler.jsonc"),
      `// a comment\n{ "vars": { "APP_URL": "https://example.com" },\n "env": { "staging": { "vars": { "APP_URL": "https://s.example.workers.dev" } } } }`,
    );
    const script = join(process.cwd(), ".github/scripts/check-app-url.sh");
    const checked = (env: string, url: string) =>
      spawnSync("sh", [script, env, url], { cwd: dir, encoding: "utf8" });
    expect(checked("production", "https://example.com/").status).toBe(0);
    expect(checked("staging", "https://s.example.workers.dev").status).toBe(0);
    const wrong = checked("production", "https://app.example.com");
    expect(wrong.status).toBe(1);
    expect(wrong.stdout).toContain("PRODUCTION_URL is https://app.example.com");
    expect(wrong.stdout).toContain("APP_URL in wrangler.jsonc is https://example.com");
  });

  it("keeps the production job's write token from the packages it installs", () => {
    expect(workflow("deploy")).toMatch(
      / {2}production:\n[\s\S]*contents: write[\s\S]*persist-credentials: false[\s\S]*bun install/,
    );
  });
});

describe("gradual rollout", () => {
  const workflow = (name: string) => read(`.github/workflows/${name}.yml`);

  it.skipIf(noGithub)("tags staging's deploys, so its events name a commit and not an id", () => {
    expect(workflow("deploy")).toMatch(
      /bun run deploy:staging --tag "staging-\$\{GITHUB_SHA::7\}"/,
    );
  });

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

  it.skipIf(noGithub || noJq)("backs out when one address gets both versions", () => {
    expect(workflow("deploy")).toMatch(
      /versions deploy "\$NEW@\$PERCENT" "\$OLD"[\s\S]*if ! sh \.github\/scripts\/check-pinned\.sh[\s\S]*versions deploy "\$OLD@100"[\s\S]*exit 1/,
    );
    // Stand-ins on PATH: curl answers with the ids given, and sleep does not wait.
    const bin = mkdtempSync(join(tmpdir(), "pinned-"));
    writeFileSync(join(bin, "sleep"), "#!/bin/sh\n", { mode: 0o755 });
    const answeredBy = (...ids: Array<string>) => {
      const bodies = ids.map((id) => `{"version":{"id":"${id}"}}`).join("");
      writeFileSync(join(bin, "curl"), `#!/bin/sh\necho '${bodies}'\n`, { mode: 0o755 });
      const script = "sh .github/scripts/check-pinned.sh https://app.test";
      return spawnSync("sh", ["-c", `PATH="${bin}:$PATH" ${script}`]).status;
    };
    expect(answeredBy("a", "a", "a")).toBe(0);
    expect(answeredBy("a", "b", "a")).toBe(1);
  });

  it.skipIf(noGithub || noJq)(
    "makes the pinning rule before it migrates, and only when it is missing",
    () => {
      expect(workflow("deploy")).toMatch(
        /name: Check a gradual rollout can start[\s\S]*sh \.github\/scripts\/pin-visitors\.sh "\$URL"[\s\S]*name: Migrate and deploy/,
      );
      // A stand-in for curl: it logs each call, and answers the ruleset read with $CODE and $RULES.
      const bin = mkdtempSync(join(tmpdir(), "pin-"));
      const log = join(bin, "calls");
      writeFileSync(
        join(bin, "curl"),
        `#!/bin/sh
out= url= method=GET
while [ $# -gt 0 ]; do
  case $1 in -o) out=$2; shift ;; -X) method=$2; shift ;; -w | -H | -d | --max-time) shift ;; http*) url=$1 ;; esac
  shift
done
echo "$method $url" >> ${log}
case "$method $url" in
  "GET "*"zones?name="*) echo '{"result":[{"id":"z1"}]}' ;;
  "GET "*entrypoint) echo "{\\"result\\":{\\"id\\":\\"rs1\\",\\"rules\\":$RULES}}" > "$out"; printf '%s' "$CODE" ;;
  *) echo "{\\"success\\":$MADE}" ;;
esac
`,
        { mode: 0o755 },
      );
      const writes = (code: number, rules: string, made = true) => {
        writeFileSync(log, "");
        const env = `PATH="${bin}:$PATH" CLOUDFLARE_API_TOKEN=t CODE=${code} RULES='${rules}' MADE=${made}`;
        const ran = spawnSync("sh", [
          "-c",
          `${env} sh .github/scripts/pin-visitors.sh https://app.example.com/`,
        ]);
        expect(ran.status).toBe(made ? 0 : 1);
        return read(log)
          .split("\n")
          .filter((call) => call.startsWith("POST"));
      };
      const pinned = (expression: string) =>
        `[{"expression":${JSON.stringify(expression)},"action_parameters":{"headers":{"cloudflare-workers-version-key":{}}}}]`;
      expect(writes(200, pinned("true"))).toEqual([]);
      expect(writes(200, pinned('(http.host eq "other.example.com")'))).toEqual([
        "POST https://api.cloudflare.com/client/v4/zones/z1/rulesets/rs1/rules",
      ]);
      expect(writes(404, "[]")).toEqual([
        "POST https://api.cloudflare.com/client/v4/zones/z1/rulesets",
      ]);
      expect(writes(403, "[]")).toEqual([]);
      // Known to be missing and refused: the one case that stops the release.
      expect(writes(200, "[]", false)).toHaveLength(1);
    },
  );

  it.skipIf(noGithub)("moves the share under the production deploy's lock and environment", () => {
    const rollout = workflow("rollout");
    expect(workflow("deploy")).toMatch(/^concurrency: deploy-\$\{\{ github\.ref_name \}\}$/m);
    expect(rollout).toMatch(/^concurrency: deploy-production$/m);
    expect(rollout).toMatch(/^ {4}environment:\n {6}name: production$/m);
    expect(rollout).toMatch(/"back out"\) bun run wrangler versions deploy "\$old@100"/);
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
