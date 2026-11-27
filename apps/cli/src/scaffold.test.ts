import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifests } from "@tanstack-cf-saas/blocks";
import { parse } from "jsonc-parser";
import { add, remove } from "./commands.ts";
import {
  blankSettings,
  hasTables,
  namespaceIds,
  parseFeatures,
  scaffold,
  titleCase,
  validateName,
} from "./scaffold.ts";

const TEMPLATE = join(import.meta.dirname, "../template");
const HARNESS = join(import.meta.dirname, "../harness");
const HUSKY = join(import.meta.dirname, "../husky");

const target = () => {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-"));
  rmSync(dir, { recursive: true });
  return dir;
};

describe("scaffold", () => {
  test("keeps the chosen features and what they require, and names the project", () => {
    const dir = target();
    const result = scaffold({
      templateDir: TEMPLATE,
      harnessDir: HARNESS,
      targetDir: dir,
      name: "acme-app",
      features: ["billing"],
    });
    expect(result.features).toEqual(["db", "auth", "billing"]);
    expect(existsSync(join(dir, "src/features/core/kv"))).toBe(false);
    expect(existsSync(join(dir, "src/features/core/db"))).toBe(true);
    expect(existsSync(join(dir, "src/features/uploads"))).toBe(false);
    expect(existsSync(join(dir, "src/features/core/ui"))).toBe(true);
    expect(existsSync(join(dir, "src/features/core/lib/call.ts"))).toBe(true);
    expect(hasTables(dir)).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name).toBe("acme-app");
    const wrangler = readFileSync(join(dir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain('"name": "acme-app"');
    expect(wrangler).toContain("acme-app-db-staging");
    expect(wrangler).not.toContain("UPLOAD_LIMITER");
    expect(readFileSync(join(dir, "src/routes/__root.tsx"), "utf8")).toContain(
      'APP_NAME = "Acme App"',
    );
    expect(readFileSync(join(dir, ".dev.vars"), "utf8")).toMatch(/^BETTER_AUTH_SECRET=\S{32,}$/m);
  });

  test("adds the commit hooks and husky only when asked", () => {
    const pkg = (huskyDir: string | undefined) => {
      const dir = target();
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        huskyDir,
        targetDir: dir,
        name: "a",
        features: [],
      });
      return { dir, ...JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) };
    };
    const without = pkg(undefined);
    expect(existsSync(join(without.dir, ".husky"))).toBe(false);
    expect(without.scripts.prepare).toBeUndefined();
    expect(without.devDependencies.husky).toBeUndefined();

    const withHooks = pkg(HUSKY);
    expect(readdirSync(join(withHooks.dir, ".husky")).sort()).toEqual(["commit-msg", "pre-commit"]);
    expect(withHooks.scripts.prepare).toBe("husky");
    // The project gets the husky this repo itself runs.
    const root = JSON.parse(
      readFileSync(join(import.meta.dirname, "../../../package.json"), "utf8"),
    );
    expect(withHooks.devDependencies.husky).toBe(root.devDependencies.husky);
    expect(Object.keys(withHooks.devDependencies)).toEqual(
      Object.keys(without.devDependencies).concat("husky").sort(),
    );
  });

  test("leaves out the GitHub workflows, rules and their docs only when told to", () => {
    const make = (github?: boolean) => {
      const dir = target();
      const options = { templateDir: TEMPLATE, harnessDir: undefined, targetDir: dir };
      scaffold({ ...options, name: "a", features: [], github });
      return { dir, readme: readFileSync(join(dir, "README.md"), "utf8") };
    };
    const kept = make();
    expect(readdirSync(join(kept.dir, ".github/workflows")).sort()).toEqual(
      ["ci.yml", "deploy.yml", "pr.yml", "promote.yml", "rollout.yml", "title.yml"], // the README says six
    );
    expect(readdirSync(join(kept.dir, ".github/rulesets")).sort()).toEqual([
      "production.json",
      "staging.json",
    ]);
    expect(kept.readme).toContain("docs/branches.md");

    const without = make(false);
    for (const path of [".github", "docs/branches.md"])
      expect([path, existsSync(join(without.dir, path))]).toEqual([path, false]);
    expect(without.readme).not.toMatch(/\.github|branches\.md|github:(start|end)/);
    // The `github` command applies rulesets, and this project has none.
    expect(kept.readme).toContain("bunx create-tanstack-cf-saas github ");
    expect(without.readme).not.toContain("create-tanstack-cf-saas github");
    // Nothing left in the project points at a file that is gone.
    expect(readFileSync(join(without.dir, "docs/runbook.md"), "utf8")).not.toContain("branches.md");
  });

  test("pins this repo's Bun in a Bun project, and no package manager in any other", () => {
    const pinned = (pm?: string) => {
      const dir = target();
      const options = { templateDir: TEMPLATE, harnessDir: undefined, targetDir: dir };
      scaffold({ ...options, name: "a", features: [], ...(pm ? { pm } : {}) });
      return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).packageManager;
    };
    const root = JSON.parse(
      readFileSync(join(import.meta.dirname, "../../../package.json"), "utf8"),
    );
    expect(pinned()).toBe(root.packageManager);
    expect(pinned("bun")).toBe(root.packageManager);
    expect(pinned("pnpm")).toBeUndefined();
  });

  test("gives each project its own rate-limit namespace ids", () => {
    const ids = (name: string) => {
      const dir = target();
      const options = { templateDir: TEMPLATE, harnessDir: undefined, targetDir: dir };
      scaffold({ ...options, name, features: ["auth"] });
      const json = parse(readFileSync(join(dir, "wrangler.jsonc"), "utf8"));
      return [...json.ratelimits, ...json.env.staging.ratelimits].map(
        (r: { namespace_id: string }) => r.namespace_id,
      );
    };
    const a = ids("app-a");
    const b = ids("app-b");
    expect(a.length).toBeGreaterThan(2);
    expect(new Set(a).size).toBe(a.length);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
    expect(a.some((id) => /^[12]00\d$/.test(id))).toBe(false);
  });

  test("asks for billing's Stripe settings and writes the answers into .dev.vars", () => {
    expect(blankSettings(TEMPLATE, ["db", "auth"])).toEqual([]);
    const blanks = blankSettings(TEMPLATE, ["db", "auth", "billing"]);
    expect(blanks.map((b) => [b.key, b.secret])).toEqual([
      ["STRIPE_PRICE_PRO", false],
      ["STRIPE_SECRET_KEY", true],
      ["STRIPE_WEBHOOK_SECRET", true],
    ]);
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "acme-app",
      features: ["db", "auth", "billing"],
      devVars: { STRIPE_SECRET_KEY: "sk_test_1", STRIPE_PRICE_PRO: "bad\nLINE=1" },
    });
    const devVars = readFileSync(join(dir, ".dev.vars"), "utf8");
    expect(devVars).toMatch(/^STRIPE_SECRET_KEY=sk_test_1$/m);
    expect(devVars).toMatch(/^STRIPE_PRICE_PRO=$/m);
    expect(devVars).toMatch(/^STRIPE_WEBHOOK_SECRET=$/m);
    expect(devVars).toMatch(/^BETTER_AUTH_SECRET=\S{32,}$/m);
  });

  test("a PostHog key switches staging and production to PostHog, and leaves dev on console", () => {
    const vars = (dir: string, env: string) => {
      const json = parse(readFileSync(join(dir, "wrangler.jsonc"), "utf8"));
      return env === "production" ? json.vars : json.env[env].vars;
    };
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "acme-app",
      features: [],
      devVars: { POSTHOG_KEY: "phc_test", POSTHOG_HOST: "https://eu.i.posthog.com" },
    });
    for (const env of ["production", "staging"])
      expect(vars(dir, env)).toMatchObject({
        ANALYTICS_PROVIDER: "posthog",
        POSTHOG_HOST: "https://eu.i.posthog.com",
      });
    const devVars = readFileSync(join(dir, ".dev.vars"), "utf8");
    expect(devVars).toMatch(/^POSTHOG_KEY=phc_test$/m);
    expect(devVars).toMatch(/^POSTHOG_HOST=https:\/\/eu\.i\.posthog\.com$/m);
    expect(devVars).toMatch(/^ANALYTICS_PROVIDER=console$/m);

    const without = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: without,
      name: "acme-app",
      features: [],
    });
    expect(vars(without, "production").ANALYTICS_PROVIDER).toBe("console");
  });

  test("leaves no trace of removed features in generated files or package.json", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "bare",
      features: [],
    });
    const gen = [
      "layers",
      "errors",
      "events",
      "nav",
      "auth-plugins",
      "workflows",
      "viewer",
      "env",
      "routes",
    ]
      .map((f) => readFileSync(join(dir, `src/gen/${f}.ts`), "utf8"))
      .join("\n");
    for (const name of ["db", "auth", "billing", "kv", "workflows", "uploads"]) {
      expect(gen).not.toContain(`features/${name}/`);
      expect(gen).not.toContain(`features/core/${name}/`);
    }
    expect(hasTables(dir)).toBe(false);
    const index = readFileSync(join(dir, "FEATURES.md"), "utf8");
    expect(index.match(/^- \*\*/gm)?.length).toBe(5);
    expect(index).not.toContain("(optional)");
    const pkg = readFileSync(join(dir, "package.json"), "utf8");
    for (const dep of ["better-auth", "drizzle-orm", "stripe", "db:generate"])
      expect(pkg).not.toContain(dep);
    expect(existsSync(join(dir, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  test("copies the harness and locks it", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: HARNESS,
      targetDir: dir,
      name: "with-harness",
      features: [],
    });
    expect(existsSync(join(dir, ".claude/settings.json"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "harness.lock.json"), "utf8")).files["settings.json"],
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  test("starts each feature's History and keeps its Decisions", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "dated",
      features: ["kv"],
      date: "2030-01-02",
    });
    const kv = readFileSync(join(dir, "src/features/core/kv/TIMELINE.md"), "utf8");
    const history = kv.slice(kv.indexOf("## History"));
    expect(history.match(/^- \d{4}/gm)).toEqual(["- 2030"]);
    expect(history).toMatch(
      /^- 2030-01-02 — Created from create-tanstack-cf-saas \d+\.\d+\.\d+\.$/m,
    );
    expect(history).not.toContain("src/blocks");
    expect(kv.slice(kv.indexOf("## Decisions"), kv.indexOf("## History"))).toContain("Why:");
    expect(kv).toContain("<!-- generated:end -->");
  });

  test("finds core modules and features by name", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "by-name",
      features: ["db", "kv", "auth"],
    });
    const dirs = Object.fromEntries([...loadManifests(dir)].map(([name, m]) => [name, m.dir]));
    expect(dirs.kv).toBe("src/features/core/kv");
    expect(dirs.ui).toBe("src/features/core/ui");
    expect(dirs.auth).toBe("src/features/auth");
    expect(dirs.consent).toBe("src/features/consent");
  });

  test("add kv then remove kv in a committed project leaves git status clean", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "round-trip",
      features: ["auth"],
    });
    const git = (...args: Array<string>) =>
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
        cwd: dir,
        encoding: "utf8",
      });
    git("init", "--quiet");
    git("add", "-A");
    expect(git("commit", "--quiet", "-m", "start").status).toBe(0);
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      add("kv");
      expect(existsSync(join(dir, "src/features/core/kv/api/key-value.ts"))).toBe(true);
      expect(git("status", "--porcelain").stdout).not.toBe("");
      // kv's files are new and uncommitted, so only --force removes them.
      expect(() => remove(["kv"])).toThrow(/uncommitted changes/);
      remove(["kv"], true);
    } finally {
      process.chdir(cwd);
    }
    expect(git("status", "--porcelain").stdout).toBe("");
  });

  test("add commits its scaffolding in a project with the hooks, from a clean tree only", () => {
    const dir = target();
    const options = { templateDir: TEMPLATE, harnessDir: undefined, huskyDir: HUSKY };
    scaffold({ ...options, targetDir: dir, name: "hooked", features: [] });
    const git = (...args: Array<string>) =>
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
        cwd: dir,
        encoding: "utf8",
      }).stdout.trim();
    git("init", "--quiet");
    git("add", "-A");
    git("commit", "--quiet", "-m", "chore: start");
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      add("kv");
      expect(git("status", "--porcelain")).toBe("");
      expect(git("log", "-1", "--format=%s")).toMatch(
        /^feat\(scaffold\): add kv with create-tanstack-cf-saas /,
      );

      // With the owner's work in the tree, the commit would hold more than scaffolding.
      writeFileSync(join(dir, "mine.ts"), "export {};\n");
      add("db");
      expect(git("status", "--porcelain")).toContain("mine.ts");
      expect(git("log", "-1", "--format=%s")).toMatch(/^feat\(scaffold\): add kv /);
    } finally {
      process.chdir(cwd);
    }
  });

  test("add takes several names, and gives a new limiter an id of its own", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "many",
      features: [],
    });
    const before = namespaceIds(dir);
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      expect(() => add("kv", "nope")).toThrow(/Unknown feature\(s\): nope/);
      expect(existsSync(join(dir, "src/features/core/kv"))).toBe(false);
      add("kv,auth", "workflows");
    } finally {
      process.chdir(cwd);
    }
    for (const folder of ["core/kv", "auth", "workflows"]) {
      expect(existsSync(join(dir, "src/features", folder, "feature.json"))).toBe(true);
    }
    const after = [...namespaceIds(dir)];
    expect(after.length).toBeGreaterThan(before.size);
    expect(after.filter((id) => before.has(id)).length).toBe(before.size);
    expect(after.some((id) => /^[12]00\d$/.test(id))).toBe(false);
  });

  test("accepts the old block names d1 and r2", () => {
    const dir = target();
    const result = scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "old-names",
      features: ["r2"],
    });
    expect(result.features).toEqual(["db", "auth", "uploads"]);
  });

  test("refuses a bad name, an unknown feature and a non-empty folder", () => {
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: target(),
        name: "Bad Name",
        features: [],
      }),
    ).toThrow(/lowercase/);
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: target(),
        name: "ok",
        features: ["nope"],
      }),
    ).toThrow(/Unknown feature/);
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: import.meta.dirname,
        name: "ok",
        features: [],
      }),
    ).toThrow(/not empty/);
  });
});

describe("parseFeatures", () => {
  test("splits, trims, drops repeats and maps old names with a note", () => {
    expect(parseFeatures(" d1, auth,,r2,db ")).toEqual({
      features: ["db", "auth", "uploads"],
      notes: ['"d1" is now called "db".', '"r2" is now called "uploads".'],
    });
    expect(parseFeatures("")).toEqual({ features: [], notes: [] });
  });
});

describe("names", () => {
  test("validates and title-cases", () => {
    expect(validateName("my-app")).toBeUndefined();
    expect(validateName("-x")).toBeDefined();
    expect(titleCase("my-cool-app")).toBe("My Cool App");
  });
});
