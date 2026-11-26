import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The hooks as they ship to new projects. Husky runs each with `sh -e`, and so does this. */
const HOOKS = join(import.meta.dirname, "../husky");
const passes = (hook: string, cwd: string, ...args: Array<string>) =>
  spawnSync("sh", ["-e", join(HOOKS, hook), ...args], { cwd, encoding: "utf8" }).status === 0;
const temp = () => mkdtempSync(join(tmpdir(), "hooks-"));

describe("commit-msg", () => {
  const accepts = (message: string) => {
    const dir = temp();
    writeFileSync(join(dir, "msg"), message);
    return passes("commit-msg", dir, "msg");
  };

  test("takes a conventional commit, and the lines git writes itself", () => {
    for (const message of [
      "fix(billing): keep Stripe's status\n\nThe body is free text.",
      "feat(cli)!: drop node 18",
      "build(deps): bump vite from 8.3.8 to 8.3.9 (#31)",
      "\n# a comment the editor left\nchore(release): version packages\n",
      "Merge branch 'staging' into feature",
      'Revert "feat: add husky"',
      "fixup! feat: add husky",
    ])
      expect([message, accepts(message)]).toEqual([message, true]);
  });

  test("refuses anything else", () => {
    for (const message of [
      "Add husky",
      "feat add husky",
      "feat: no scope",
      "feat(): x",
      "feat(cli):no space",
      "Feat(cli): x",
      "feat(cli): ",
    ])
      expect([message, accepts(message)]).toEqual([message, false]);
  });
});

// A squashed pull request's title becomes the commit, so title.yml runs the hook on it.
describe.each([
  ["this repo's", join(import.meta.dirname, "../../../.github/workflows/title.yml")],
  ["a new project's", join(import.meta.dirname, "../template/.github/workflows/title.yml")],
])("%s title.yml", (_, workflow) => {
  /** The step's script, run as the runner would: in a checkout that holds `.husky`. */
  const accepts = (title: string) => {
    const dir = temp();
    cpSync(HOOKS, join(dir, ".husky"), { recursive: true });
    const script = (readFileSync(workflow, "utf8").split("run: |\n")[1] ?? "").replace(/^ +/gm, "");
    const env = { ...process.env, TITLE: title, RUNNER_TEMP: dir };
    return spawnSync("sh", ["-e", "-c", script], { cwd: dir, env }).status === 0;
  };

  test("takes a conventional title and refuses the lines only git writes", () => {
    expect(accepts("fix(billing): keep Stripe's status")).toBe(true);
    for (const title of [
      "Merge everything",
      'Revert "feat: add husky"',
      "fixup! x",
      "fix: no scope",
    ])
      expect([title, accepts(title)]).toEqual([title, false]);
  });
});

describe("pre-commit", () => {
  const git = (dir: string, ...args: Array<string>) =>
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: dir,
    });
  /** A repository with `lines` lines staged in each of `paths`. */
  const staged = (lines: number, ...paths: Array<string>) => {
    const dir = temp();
    git(dir, "init", "--quiet");
    git(dir, "commit", "--quiet", "--no-verify", "--allow-empty", "-m", "chore: start");
    for (const path of paths) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), "line\n".repeat(lines));
    }
    git(dir, "add", "-A");
    return dir;
  };

  test("takes 400 added lines and refuses 401", () => {
    expect(passes("pre-commit", staged(200, "a.ts", "b.ts"))).toBe(true);
    expect(passes("pre-commit", staged(401, "a.ts"))).toBe(false);
  });

  test("counts code only: not Markdown, lockfiles or generated files", () => {
    const dir = staged(
      401,
      "README.md",
      "docs/a.md",
      "bun.lock",
      "src/gen/routes.ts",
      "drizzle/0.sql",
    );
    expect(passes("pre-commit", dir)).toBe(true);
  });

  test("lets a merge, a revert and a cherry-pick through", () => {
    for (const head of ["MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD"]) {
      const dir = staged(401, "a.ts");
      // Newer git refuses update-ref on MERGE_HEAD, which it keeps as a plain file.
      if (head === "MERGE_HEAD")
        writeFileSync(join(dir, ".git", head), git(dir, "rev-parse", "HEAD").stdout);
      else git(dir, "update-ref", head, "HEAD");
      expect([head, git(dir, "rev-parse", "--verify", head).status]).toEqual([head, 0]);
      expect([head, passes("pre-commit", dir)]).toEqual([head, true]);
    }
  });
});
