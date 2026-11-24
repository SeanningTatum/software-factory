export type PackageManager = "bun" | "pnpm" | "npm" | "yarn";
export const packageManagers: ReadonlyArray<PackageManager> = ["bun", "pnpm", "npm", "yarn"];

/** The package manager that launched us (`bunx`, `pnpm dlx`, `npx`), else bun. */
export const detectPackageManager = (userAgent = process.env.npm_config_user_agent ?? ""): PackageManager =>
  packageManagers.find((pm) => userAgent.startsWith(pm)) ?? "bun";

export const installCommand = (pm: PackageManager): [string, Array<string>] => [pm, ["install"]];

export const runCommand = (pm: PackageManager, script: string): [string, Array<string>] =>
  pm === "npm" ? ["npm", ["run", script]] : [pm, ["run", script]];

export const execCommand = (pm: PackageManager): string =>
  ({ bun: "bunx", pnpm: "pnpm dlx", npm: "npx", yarn: "yarn dlx" })[pm];
