import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runTimeline } from "./timeline-git.ts";

const write = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

// Windows can hold .git/index.lock for a moment; retry before failing.
const git = (root: string, ...args: Array<string>) => {
  for (let attempt = 1; ; attempt++) {
    const out = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: root,
      encoding: "utf8",
    });
    if (out.status === 0) return;
    if (attempt === 3) throw new Error(`git ${args.join(" ")} failed:\n${out.stderr}`);
    Bun.sleepSync(250);
  }
};

/** A repo with one commit holding feature kv and its timeline. */
const repo = () => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-timeline-"));
  git(root, "init", "-q");
  write(root, "src/features/kv/api/key-value.ts", "export const a = 1;\n");
  write(root, "src/features/kv/TIMELINE.md", "## Decisions\n\n## History\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "start");
  return root;
};

describe("runTimeline", () => {
  test("skips outside a git repository and when asked", () => {
    const plain = mkdtempSync(join(tmpdir(), "cf-saas-timeline-"));
    expect(runTimeline(plain).code).toBe(0);
    expect(runTimeline(plain).lines[0]).toContain("not a git repository");
    expect(runTimeline(repo(), { skip: true }).lines[0]).toContain("skipped");
  });

  test("skips when there is no base ref", () => {
    const result = runTimeline(repo());
    expect(result).toEqual({
      code: 0,
      lines: ["timeline: no base ref (origin/staging, origin/main, HEAD~1); skipped."],
    });
  });

  test("fails when the base it was given does not exist", () => {
    const result = runTimeline(repo(), { base: "origin/nope" });
    expect(result.code).toBe(1);
    expect(result.lines[0]).toContain('"origin/nope" not found');
  });

  test("fails a feature change with no new line, and passes once one is added", () => {
    const root = repo();
    write(root, "src/features/kv/api/key-value.ts", "export const a = 2;\n");
    write(root, "src/features/kv/lib/new.ts", "export const b = 1;\n");
    const failed = runTimeline(root, { base: "HEAD" });
    expect(failed.code).toBe(1);
    expect(failed.lines[0]).toStartWith("kv changed (api/key-value.ts, lib/new.ts)");
    write(root, "src/features/kv/TIMELINE.md", "## Decisions\n\n## History\n- 2026-11-25 — x.\n");
    expect(runTimeline(root, { base: "HEAD" }).code).toBe(0);
  });

  test("sees a file name git would quote, and both ends of a move", () => {
    const root = repo();
    write(root, "src/features/auth/TIMELINE.md", "## History\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "auth");
    write(root, "src/features/kv/api/naïve.ts", "export const n = 1;\n");
    expect(runTimeline(root, { base: "HEAD" }).lines[0]).toStartWith("kv changed (api/naïve.ts)");
    git(root, "add", ".");
    git(root, "commit", "-qm", "naive");
    git(root, "mv", "src/features/kv/api/key-value.ts", "src/features/auth/key-value.ts");
    const moved = runTimeline(root, { base: "HEAD" });
    expect(moved.lines.slice(0, 2).map((l) => l.slice(0, l.indexOf(" ")))).toEqual(["auth", "kv"]);
  });
});
