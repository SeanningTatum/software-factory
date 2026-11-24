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

const git = (root: string, ...args: Array<string>) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
    cwd: root,
  });

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
      lines: ["timeline: no base ref (origin/main, HEAD~1); skipped."],
    });
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
});
