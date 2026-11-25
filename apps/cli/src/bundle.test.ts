import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dirname, "../scripts/bundle-template.ts");

/** A throwaway repo laid out like this one, with the bundle script in place. */
const fakeRepo = (pkg: object) => {
  const repo = mkdtempSync(join(tmpdir(), "bundle-"));
  const template = join(repo, "templates/saas-starter");
  mkdirSync(join(repo, "apps/cli/scripts"), { recursive: true });
  mkdirSync(join(repo, "packages"));
  mkdirSync(join(template, ".claude"), { recursive: true });
  cpSync(SCRIPT, join(repo, "apps/cli/scripts/bundle-template.ts"));
  writeFileSync(join(template, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(template, ".gitignore"), ".dev.vars*\n!.dev.vars.example\n");
  writeFileSync(join(template, ".dev.vars.production"), "STRIPE_SECRET_KEY=sk_live_x\n");
  writeFileSync(join(template, ".env"), "CLOUDFLARE_API_TOKEN=x\n");
  writeFileSync(join(template, ".claude/settings.local.json"), "{}\n");
  writeFileSync(join(template, ".dev.vars.example"), "BETTER_AUTH_SECRET=\n");
  writeFileSync(join(template, "new.ts"), "export {};\n");
  const git = (...args: Array<string>) => spawnSync("git", args, { cwd: repo });
  git("init", "--quiet");
  git("add", "templates/saas-starter/package.json", "templates/saas-starter/.gitignore");
  return { repo, bundled: join(repo, "apps/cli/template") };
};

const bundle = (repo: string) =>
  spawnSync("bun", ["apps/cli/scripts/bundle-template.ts"], { cwd: repo, encoding: "utf8" });

describe("bundle-template", () => {
  test("ships what git would commit, never local secrets or settings", () => {
    const { repo, bundled } = fakeRepo({ name: "x", private: true });
    expect(bundle(repo).status).toBe(0);
    for (const kept of ["package.json", "_gitignore", ".dev.vars.example", "new.ts"])
      expect(existsSync(join(bundled, kept))).toBe(true);
    for (const leak of [".env", ".dev.vars.production", ".claude/settings.local.json"])
      expect(existsSync(join(bundled, leak))).toBe(false);
  });

  test("refuses a template that depends on a local file", () => {
    const { repo } = fakeRepo({ name: "x", devDependencies: { a: "file:/Users/me/a.tgz" } });
    const result = bundle(repo);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("local dependency");
  });
});

test("the bundled template holds no local links (a `bun run try` must not leak into it)", () => {
  const text = readFileSync(join(import.meta.dirname, "../template/package.json"), "utf8");
  expect(text).not.toMatch(/"(?:file|workspace|link):/);
});

test("a project carries the CLI that made it, so `setup` runs from the project", () => {
  const read = (path: string) => JSON.parse(readFileSync(join(import.meta.dirname, path), "utf8"));
  const project = read("../template/package.json");
  expect(project.devDependencies["create-tanstack-cf-saas"]).toBe(
    `^${read("../package.json").version}`,
  );
  expect(project.scripts.setup).toBe("create-tanstack-cf-saas setup");
});
