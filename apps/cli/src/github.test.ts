import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Cli, setDeploySettings, setupGithub } from "./github.ts";

const TEMPLATE = join(import.meta.dirname, "../../../templates/saas-starter");
const ok = (stdout = "") => ({ ok: true, stdout, stderr: "" });
const fail = (stderr = "") => ({ ok: false, stdout: "", stderr });

/** A fake GitHub: remembers the remote, its branches and its rulesets across runs. */
const fakeGithub = () => {
  const state = { remote: false, heads: new Set<string>(), rulesets: [] as Array<string> };
  const calls: Array<string> = [];
  const bodies: Array<{ name: string }> = [];
  const gh: Cli = (args, input) => {
    calls.push(`gh ${args.join(" ")}`);
    if (args[1] === "create") state.remote = true;
    if (args.includes("--input")) {
      const body = JSON.parse(input ?? "") as { name: string };
      bodies.push(body);
      if (args.includes("POST")) state.rulesets.push(body.name);
    }
    if (args[1]?.includes("includes_parents"))
      return ok(JSON.stringify(state.rulesets.map((name, i) => ({ id: i + 1, name }))));
    return ok();
  };
  const git: Cli = (args) => {
    calls.push(`git ${args.join(" ")}`);
    if (args[0] === "remote") return state.remote ? ok("url") : fail();
    if (args[0] === "ls-remote")
      return ok([...state.heads].map((h) => `abc\trefs/heads/${h}\n`).join(""));
    if (args[0] === "push") state.heads.add(args.at(-1)?.split("/").at(-1) ?? "");
    return ok();
  };
  return { gh, git, calls, bodies, state };
};

const options = { name: () => "my-app", visibility: "private" as const, log: () => {} };

describe("setupGithub", () => {
  test("creates the repository, both branches and both rulesets, then only updates", () => {
    const fake = fakeGithub();
    setupGithub(TEMPLATE, fake.gh, fake.git, options);
    expect(fake.calls).toContain("gh repo create my-app --private --source . --remote origin");
    expect(fake.calls).toContain("git push --set-upstream origin staging");
    expect(fake.calls).toContain("git push origin FETCH_HEAD:refs/heads/production");
    expect(fake.calls).toContain(
      "gh api --method PATCH repos/{owner}/{repo} -f default_branch=staging -f squash_merge_commit_title=PR_TITLE -F allow_squash_merge=true -F allow_merge_commit=true",
    );
    expect(fake.state.rulesets).toEqual(["production", "staging"]);
    expect(fake.bodies.map((b) => b.name)).toEqual(["production", "staging"]);

    fake.calls.length = 0;
    setupGithub(TEMPLATE, fake.gh, fake.git, options);
    const changes = fake.calls.filter((c) => /create|push|POST|PUT/.test(c));
    expect(changes).toEqual([
      "gh api --method PUT repos/{owner}/{repo}/rulesets/1 --input -",
      "gh api --method PUT repos/{owner}/{repo}/rulesets/2 --input -",
    ]);
  });

  test("sets the deploy settings before the first push, so that push can deploy", () => {
    const fake = fakeGithub();
    const missing = setupGithub(TEMPLATE, fake.gh, fake.git, {
      ...options,
      deploy: {
        variables: {
          CLOUDFLARE_ACCOUNT_ID: "abc123",
          STAGING_URL: "https://staging.example.com",
          PRODUCTION_URL: undefined,
        },
        token: "t",
      },
    });
    expect(missing).toEqual(["PRODUCTION_URL"]);
    const at = (text: string) => fake.calls.findIndex((c) => c.includes(text));
    expect(at("repo create")).toBeLessThan(at("variable set CLOUDFLARE_ACCOUNT_ID"));
    expect(at("secret set CLOUDFLARE_API_TOKEN")).toBeLessThan(at("git push"));
  });

  test("stops with GitHub's own words when a call fails", () => {
    const fake = fakeGithub();
    const gh: Cli = (args, input) =>
      args.includes("POST") ? fail("Upgrade to GitHub Pro (HTTP 403)") : fake.gh(args, input);
    expect(() => setupGithub(TEMPLATE, gh, fake.git, options)).toThrow(/Upgrade to GitHub Pro/);
  });

  test("asks for gh, a staging branch and rulesets before it touches anything", () => {
    const fake = fakeGithub();
    const noGh: Cli = () => fail("github.example.com: token expired");
    expect(() => setupGithub(TEMPLATE, noGh, fake.git, options)).toThrow(/token expired/);
    const noStaging: Cli = (args) => (args[0] === "rev-parse" ? fail() : fake.git(args));
    expect(() => setupGithub(TEMPLATE, fake.gh, noStaging, options)).toThrow(
      /git branch -m staging/,
    );
    expect(fake.calls.some((c) => /create|push/.test(c))).toBe(false);

    fake.calls.length = 0;
    const empty = mkdtempSync(join(tmpdir(), "gh-"));
    expect(() => setupGithub(empty, fake.gh, fake.git, options)).toThrow(/No rulesets/);
    mkdirSync(join(empty, ".github/rulesets"), { recursive: true });
    writeFileSync(join(empty, ".github/rulesets/bad.json"), "{");
    expect(() => setupGithub(empty, fake.gh, fake.git, options)).toThrow(
      /bad\.json is not a ruleset/,
    );
    expect(fake.calls).toEqual([]);
  });

  test("a repository on another default branch is renamed on GitHub, not given a second one", () => {
    const fake = fakeGithub();
    fake.state.remote = true;
    fake.state.heads.add("main");
    expect(() => setupGithub(TEMPLATE, fake.gh, fake.git, options)).toThrow(/Rename its default/);
    expect(fake.calls.some((c) => /push|PATCH|POST/.test(c))).toBe(false);
  });
});

describe("setDeploySettings", () => {
  const recorder = (secrets: Array<string> = []) => {
    const calls: Array<{ args: ReadonlyArray<string>; input?: string }> = [];
    const gh: Cli = (args, input) => {
      calls.push({ args, input });
      return args[1] === "list" ? ok(JSON.stringify(secrets.map((name) => ({ name })))) : ok();
    };
    return { gh, calls };
  };
  const variables = {
    CLOUDFLARE_ACCOUNT_ID: "abc123",
    STAGING_URL: "https://staging.example.com",
    PRODUCTION_URL: undefined,
  };

  test("sets what it knows, sends the token on stdin only, and names what is missing", () => {
    const { gh, calls } = recorder();
    const lines: Array<string> = [];
    const missing = setDeploySettings(gh, variables, "cf-token-value", (l) => lines.push(l));
    expect(missing).toEqual(["PRODUCTION_URL"]);
    expect(calls.map((c) => c.args.join(" "))).toEqual([
      "variable set CLOUDFLARE_ACCOUNT_ID --body abc123",
      "variable set STAGING_URL --body https://staging.example.com",
      "secret set CLOUDFLARE_API_TOKEN",
    ]);
    expect(calls.at(-1)?.input).toBe("cf-token-value");
    expect(JSON.stringify([calls.map((c) => c.args), lines])).not.toContain("cf-token-value");
  });

  test("holds the switch back until staging has its URL and a token", () => {
    const sets = (
      v: Record<string, string | undefined>,
      token?: string,
      secrets?: Array<string>,
    ) => {
      const { gh, calls } = recorder(secrets);
      const missing = setDeploySettings(gh, v, token, () => {});
      const on = calls.some((c) =>
        c.args.join(" ").startsWith("variable set CLOUDFLARE_ACCOUNT_ID"),
      );
      return { on, missing };
    };
    const ready = { CLOUDFLARE_ACCOUNT_ID: "abc123", STAGING_URL: "https://s.example.com" };
    expect(sets(ready, "t").on).toBe(true);
    expect(sets(ready, undefined, ["CLOUDFLARE_API_TOKEN"]).on).toBe(true);
    // No token, or no URL: deploy.yml would run and could only fail.
    expect(sets(ready)).toEqual({
      on: false,
      missing: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    });
    expect(sets({ ...ready, STAGING_URL: undefined }, "t")).toEqual({
      on: false,
      missing: ["CLOUDFLARE_ACCOUNT_ID", "STAGING_URL"],
    });
  });

  test("a missing token counts as missing only when the repository has none", () => {
    expect(setDeploySettings(recorder().gh, {}, undefined, () => {})).toEqual([
      "CLOUDFLARE_API_TOKEN",
    ]);
    const set = recorder(["CLOUDFLARE_API_TOKEN"]);
    expect(setDeploySettings(set.gh, {}, undefined, () => {})).toEqual([]);
    expect(set.calls.some((c) => c.args[1] === "set")).toBe(false);
  });
});
