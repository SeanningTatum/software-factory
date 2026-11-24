import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Wrangler } from "./setup.ts";

/** Runs a command, streaming its output, and rejects when it fails. */
export const run = (cmd: string, args: ReadonlyArray<string>, cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const result = spawnSync(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status === 0) resolve();
    else
      reject(new Error(`${cmd} ${args.join(" ")} exited with ${result.status ?? result.signal}`));
  });

/** The project's own wrangler when installed, else npx. Secrets reach it on stdin only. */
export const projectWrangler =
  (cwd: string): Wrangler =>
  (args, input) => {
    const local = join(cwd, "node_modules/.bin/wrangler");
    const [cmd, prefix] = existsSync(local) ? [local, []] : ["npx", ["--yes", "wrangler"]];
    const result = spawnSync(cmd, [...prefix, ...args], {
      cwd,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    return { ok: result.status === 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
