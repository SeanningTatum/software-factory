import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
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

// npm, pnpm and yarn are .cmd files there, and Node starts one only through a shell. Its own file,
// not npm: a cold `npm --version` on a Windows runner takes longer than a test gets.
test.skipIf(process.platform !== "win32")("a .cmd file starts on Windows", () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-run-"));
  writeFileSync(join(dir, "hello.cmd"), "@echo hello\r\n");
  expect(capture("hello.cmd", dir)([]).stdout.trim()).toBe("hello");
});
