import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harness as harnessCommand } from "./commands.ts";
import { harnessStatus, installHarness, syncHarness } from "./harness.ts";

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "harness-"));
  const harness = join(root, "harness");
  const project = join(root, "project");
  mkdirSync(join(harness, "commands"), { recursive: true });
  mkdirSync(project);
  writeFileSync(join(harness, "commands/check.md"), "v1");
  writeFileSync(join(harness, ".source.json"), JSON.stringify({ repo: "claude", commit: "abc" }));
  return { harness, project };
};

describe("harness", () => {
  test("installs into .claude and locks each file", () => {
    const { harness, project } = setup();
    const lock = installHarness(harness, project);
    expect(lock.commit).toBe("abc");
    expect(Object.keys(lock.files)).toEqual(["commands/check.md"]);
    expect(readFileSync(join(project, ".claude/commands/check.md"), "utf8")).toBe("v1");
    expect(harnessStatus(project)).toEqual({ changed: [], missing: [] });
  });

  test("notices local edits and deletions", () => {
    const { harness, project } = setup();
    installHarness(harness, project);
    writeFileSync(join(project, ".claude/commands/check.md"), "mine");
    expect(harnessStatus(project).changed).toEqual(["commands/check.md"]);
    rmSync(join(project, ".claude/commands/check.md"));
    expect(harnessStatus(project).missing).toEqual(["commands/check.md"]);
  });

  test("sync updates untouched files and keeps edited ones", () => {
    const { harness, project } = setup();
    installHarness(harness, project);
    writeFileSync(join(harness, "commands/check.md"), "v2");
    expect(syncHarness(harness, project).updated).toEqual(["commands/check.md"]);
    writeFileSync(join(project, ".claude/commands/check.md"), "mine");
    writeFileSync(join(harness, "commands/check.md"), "v3");
    expect(syncHarness(harness, project).kept).toEqual(["commands/check.md"]);
    expect(readFileSync(join(project, ".claude/commands/check.md"), "utf8")).toBe("mine");
  });

  test("sync keeps a file of your own at a path the lock doesn't list", () => {
    const { harness, project } = setup();
    installHarness(harness, project);
    writeFileSync(join(harness, "commands/deploy.md"), "shipped");
    mkdirSync(join(project, ".claude/commands"), { recursive: true });
    writeFileSync(join(project, ".claude/commands/deploy.md"), "mine");
    expect(syncHarness(harness, project).kept).toEqual(["commands/deploy.md"]);
    expect(readFileSync(join(project, ".claude/commands/deploy.md"), "utf8")).toBe("mine");
    expect(harnessStatus(project).changed).toEqual(["commands/deploy.md"]);
    expect(syncHarness(harness, project, true).updated).toEqual(["commands/deploy.md"]);
  });

  test("a CRLF checkout of an untouched file is not an edit", () => {
    const { harness, project } = setup();
    writeFileSync(join(harness, "commands/check.md"), "line one\nline two\n");
    installHarness(harness, project);
    writeFileSync(join(project, ".claude/commands/check.md"), "line one\r\nline two\r\n");
    expect(harnessStatus(project)).toEqual({ changed: [], missing: [] });
  });

  test("a project without a lock gets a plain message", () => {
    const { project } = setup();
    expect(() => harnessStatus(project)).toThrow(
      /No harness.lock.json in .*\(without --no-claude\)/,
    );
  });

  test("check exits non-zero when a file changed or is missing", () => {
    const { harness, project } = setup();
    installHarness(harness, project);
    const cwd = process.cwd();
    const log = console.log;
    console.log = () => {};
    try {
      process.chdir(project);
      harnessCommand("check", false);
      expect(process.exitCode).toBeUndefined();
      writeFileSync(join(project, ".claude/commands/check.md"), "mine");
      harnessCommand("check", false);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      process.chdir(cwd);
      console.log = log;
    }
  });

  test("an unknown action is refused, not run as sync", () => {
    expect(() => harnessCommand("chek", false)).toThrow(
      'Unknown action "chek". Use check or sync.',
    );
  });
});
