import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
      "feat: add husky",
      "fix(billing): keep Stripe's status\n\nThe body is free text.",
      "feat(cli)!: drop node 18",
      "build(deps): bump vite from 8.3.8 to 8.3.9 (#31)",
      "\n# a comment the editor left\nchore: version packages\n",
      "Merge branch 'staging' into feature",
      'Revert "feat: add husky"',
      "fixup! feat: add husky",
    ])
      expect([message, accepts(message)]).toEqual([message, true]);
  });

  test("refuses anything else", () => {
    for (const message of ["Add husky", "feat add husky", "feat:no space", "Feat: x", "feat: "])
      expect([message, accepts(message)]).toEqual([message, false]);
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
      git(dir, "update-ref", head, "HEAD");
      expect([head, passes("pre-commit", dir)]).toEqual([head, true]);
    }
  });
});
