import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture, gitIdentity, run, usesShell } from "./run.ts";

test("only package managers on Windows go through a shell", () => {
  expect(usesShell("git", "win32")).toBe(false);
  expect(usesShell("gh", "win32")).toBe(false);
  expect(usesShell("npm", "win32")).toBe(true);
  expect(usesShell("npm", "linux")).toBe(false);
});

// check.yml runs this file on Windows too, where a shell would split the message at its spaces.
test("a commit message with spaces reaches git whole", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-run-"));
  const message = "chore: create project with create-tanstack-cf-saas 0.1.0";
  await run("git", ["init", "--quiet"], dir);
  const commit = ["commit", "--quiet", "--allow-empty", "--no-verify", "-m", message];
  await run("git", [...gitIdentity(dir), ...commit], dir);
  expect(capture("git", dir)(["log", "-1", "--format=%s"]).stdout.trim()).toBe(message);
});

test("a package manager that is a .cmd file on Windows still starts", () => {
  expect(capture("npm", tmpdir())(["--version"]).ok).toBe(true);
});
