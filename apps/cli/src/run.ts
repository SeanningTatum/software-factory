import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Wrangler } from "./setup.ts";

/**
 * On Windows npm, pnpm and yarn are .cmd files, which only a shell can start. A shell joins the
 * arguments without quoting them, so git and gh, whose arguments hold spaces (a commit message),
 * never get one: they are real programs and start without it.
 */
export const usesShell = (cmd: string, platform: string = process.platform) =>
  platform === "win32" && cmd !== "git" && cmd !== "gh";

/** Why a command failed. A program that isn't installed has no exit status, only an error. */
const failure = (result: SpawnSyncReturns<unknown>) =>
  result.error
    ? `could not start: ${result.error.message}`
    : `exited with ${result.status ?? result.signal}`;

/** Runs a command, streaming its output, and rejects when it fails. */
export const run = (cmd: string, args: ReadonlyArray<string>, cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: usesShell(cmd) });
    if (result.status === 0) resolve();
    else reject(new Error(`${cmd} ${args.join(" ")} ${failure(result)}`));
  });

const captured = (result: SpawnSyncReturns<string>) => ({
  ok: result.status === 0,
  stdout: result.stdout ?? "",
  stderr: result.stderr || result.error?.message || "",
});

/** Whether the project has its own wrangler. npm and pnpm add a .cmd on Windows, bun an .exe. */
export const hasWrangler = (cwd: string) =>
  ["", ".cmd", ".exe"].some((ext) => existsSync(join(cwd, `node_modules/.bin/wrangler${ext}`)));

/**
 * The project's own pinned wrangler, and never whatever `npx` would download today: it gets the
 * Cloudflare login, and secrets on stdin.
 */
export const projectWrangler =
  (cwd: string): Wrangler =>
  (args, input) => {
    if (!hasWrangler(cwd)) {
      throw new Error("wrangler isn't installed in this project. Install packages first.");
    }
    const local = join(cwd, "node_modules/.bin/wrangler");
    // With a shell on Windows, a path with a space must be quoted.
    const path = process.platform === "win32" ? JSON.stringify(local) : local;
    const result = spawnSync(path, [...args], {
      cwd,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    return captured(result);
  };

/** Runs `cmd` (gh, git, a package manager) in `cwd` and captures its output; `input` goes to stdin. */
export const capture =
  (cmd: string, cwd: string): Wrangler =>
  (args, input) => {
    const result = spawnSync(cmd, [...args], {
      cwd,
      input,
      encoding: "utf8",
      shell: usesShell(cmd),
    });
    return captured(result);
  };

/** `-c` flags with a stand-in author when git has no user.name or user.email (as in CI). */
export const gitIdentity = (cwd: string): Array<string> => {
  const has = (key: string) =>
    spawnSync("git", ["config", key], { cwd, encoding: "utf8" }).stdout.trim() !== "";
  return has("user.name") && has("user.email")
    ? []
    : ["-c", "user.name=create-tanstack-cf-saas", "-c", "user.email=noreply@example.com"];
};
