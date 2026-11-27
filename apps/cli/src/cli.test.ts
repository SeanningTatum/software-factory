import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { nameFromDir, validateName } from "./scaffold.ts";

const CLI = join(import.meta.dirname, "index.ts");
const QUICK = ["--yes", "--no-install", "--no-git", "--features", ""];

/** Runs the CLI from source; the timeout turns a hang into a failure. */
const cli = (args: Array<string>, cwd: string, env: Record<string, string> = {}) => {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, ...env },
  });
  return { ...result, out: result.stdout + result.stderr };
};

const scratch = () => realpathSync(mkdtempSync(join(tmpdir(), "cli-")));

describe("create", () => {
  test("names the project from the real folder: `my-app/` and `.`", () => {
    const dir = scratch();
    expect(cli(["my-app/", ...QUICK], dir).status).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "my-app/package.json"), "utf8")).name).toBe("my-app");
    mkdirSync(join(dir, "My App"));
    expect(cli([".", ...QUICK], join(dir, "My App")).status).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "My App/package.json"), "utf8")).name).toBe("my-app");
    expect(nameFromDir("/x/_Weird.Name__")).toBe("weird-name");
  }, 20_000); // two full scaffolds: over 5 s on a busy CI runner

  test("--no-github reaches the scaffold, and `github` there says why it has nothing to do", () => {
    const dir = scratch();
    expect(cli(["app", ...QUICK, "--no-github"], dir).status).toBe(0);
    expect(existsSync(join(dir, "app/.github"))).toBe(false);
    expect(existsSync(join(dir, "app/src"))).toBe(true);
    const result = cli(["github"], join(dir, "app"));
    expect(result.status).toBe(1);
    expect(result.out).toContain("made with --no-github");
  }, 20_000);

  test("a failed scaffold stops the spinner and exits non-zero instead of hanging", () => {
    const dir = scratch();
    const empty = scratch();
    const result = cli(["app", ...QUICK], dir, { SOFTWARE_FACTORY_TEMPLATE_DIR: empty });
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.out).toContain("may hold a partial copy");
  });

  test("a failed install says where the project is and what is left", () => {
    const dir = scratch();
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(bin, "npm"), 0o755);
    const result = cli(["app", "--yes", "--pm", "npm", "--no-git", "--features", "db"], dir, {
      PATH: `${bin}:${process.env.PATH}`,
    });
    expect(result.status).toBe(1);
    expect(result.out).toContain(`The project is in ${join(dir, "app")}`);
    expect(result.out).toContain("npm install");
    expect(result.out).toContain("npm run db:generate -- init");
  });

  test("commits with a stand-in author when git has no identity", () => {
    const dir = scratch();
    const noConfig = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    const result = cli(["app", "--yes", "--no-install", "--features", ""], dir, noConfig);
    expect(result.status).toBe(0);
    const log = spawnSync("git", ["log", "--format=%ae"], {
      cwd: join(dir, "app"),
      encoding: "utf8",
    });
    expect(log.stdout.trim()).toBe("noreply@example.com");
    // The shipped workflows deploy from `staging` and `production`, so the first branch is staging.
    const branch = spawnSync("git", ["branch", "--show-current"], {
      cwd: join(dir, "app"),
      encoding: "utf8",
    });
    expect(branch.stdout.trim()).toBe("staging");
  });

  test("warns about an unknown --pm", () => {
    const result = cli(["app", ...QUICK, "--pm", "yarnn"], scratch());
    expect(result.out).toContain('Unknown package manager "yarnn"');
  });

  test("caps names so {project}-uploads-staging fits R2's 63 characters", () => {
    const longest = "a".repeat(47);
    expect(validateName(longest)).toBeUndefined();
    expect(`${longest}-uploads-staging`.length).toBe(63);
    expect(validateName("a".repeat(48))).toBeDefined();
  });
});

describe("the command line", () => {
  test("--version prints the version", () => {
    const result = cli(["--version"], scratch());
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  test("a user error prints one line, without a stack", () => {
    const result = cli(
      ["app", "--yes", "--no-install", "--no-git", "--features", "nope"],
      scratch(),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown feature(s): nope.");
    expect(result.stderr).not.toContain("    at ");
  });

  test("setup --var without = is an error, not dropped", () => {
    const dir = scratch();
    const result = cli(["setup", "--check", "--var", "FOO"], dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--var needs KEY=value, got "FOO"');
  });

  test("add outside a project changes nothing", () => {
    const dir = scratch();
    writeFileSync(join(dir, "package.json"), "{}");
    const result = cli(["add", "kv"], dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("software-factory.json not found");
    expect(existsSync(join(dir, "src"))).toBe(false);
  });

  test("remove refuses to delete uncommitted work unless --force", () => {
    const dir = scratch();
    expect(cli(["app", "--yes", "--no-install", "--features", "kv"], dir).status).toBe(0);
    const app = join(dir, "app");
    writeFileSync(join(app, "src/features/core/kv/mine.ts"), "// mine\n");
    const refused = cli(["remove", "kv"], app);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("kv has uncommitted changes");
    expect(existsSync(join(app, "src/features/core/kv/mine.ts"))).toBe(true);
    expect(cli(["remove", "kv", "--force"], app).status).toBe(0);
    expect(existsSync(join(app, "src/features/core/kv"))).toBe(false);
  }, 20_000); // a scaffold and two removals: over 5 s on a busy CI runner
});
