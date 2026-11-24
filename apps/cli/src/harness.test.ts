import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
});
