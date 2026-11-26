import { spawnSync } from "node:child_process";
import { usesShell } from "./run.ts";

export type PackageManager = "bun" | "pnpm" | "npm" | "yarn";
export const packageManagers: ReadonlyArray<PackageManager> = ["bun", "pnpm", "npm", "yarn"];

const installed = (pm: PackageManager) =>
  spawnSync(pm, ["--version"], { stdio: "ignore", shell: usesShell(pm) }).status === 0;

/**
 * The package manager that launched us (`bunx`, `pnpm dlx`, `npx`). A global install names none,
 * so then it is the first one found on this machine, and npm, which comes with Node, at the last.
 */
export const detectPackageManager = (
  userAgent = process.env.npm_config_user_agent ?? "",
  has: (pm: PackageManager) => boolean = installed,
): PackageManager =>
  packageManagers.find((pm) => userAgent.startsWith(pm)) ?? packageManagers.find(has) ?? "npm";

export const installCommand = (pm: PackageManager): [string, Array<string>] => [pm, ["install"]];

/** Runs a package script; `args` go to the script itself, which npm needs `--` for. */
export const runCommand = (
  pm: PackageManager,
  script: string,
  ...args: ReadonlyArray<string>
): [string, Array<string>] => [
  pm,
  ["run", script, ...(pm === "npm" && args.length ? ["--"] : []), ...args],
];
