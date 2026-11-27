import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture, gitIdentity, projectWrangler, run, usesShell } from "./run.ts";

test("only package managers on Windows go through a shell", () => {
  expect(usesShell("git", "win32")).toBe(false);
  expect(usesShell("gh", "win32")).toBe(false);
  expect(usesShell("npm", "win32")).toBe(true);
  expect(usesShell("npm", "linux")).toBe(false);
});

// check.yml runs this file on Windows too, where a shell would split the message at its spaces.
test("a commit message with spaces reaches git whole", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-run-"));
  const message = "chore(scaffold): create project with create-software-factory 0.1.0";
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

// Through a shell, as on Windows, a missing program is the shell's own exit code instead.
test.skipIf(process.platform === "win32")("a missing program is named as missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-run-"));
  await expect(run("no-such-program", ["x"], dir)).rejects.toThrow(/could not start: /);
  expect(capture("no-such-program", dir)([]).stderr).toContain("no-such-program");
});

test("without the project's own wrangler nothing runs, npx least of all", () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-run-"));
  expect(() => projectWrangler(dir)(["whoami"])).toThrow(/Install packages first/);
});
