import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { addBlock, prune, removeBlock } from "./ops.ts";
import { check, plan, sync } from "./sync.ts";

const manifest = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, title: name, description: name, requires: [], ...extra });

const project = () => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-ops-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "app", dependencies: { "drizzle-orm": "1" } }),
    "cf-saas.json": JSON.stringify({
      name: "app",
      template: "t",
      managed: { bindings: [], vars: [] },
    }),
    "wrangler.jsonc": '{ "name": "app" }\n',
    "drizzle.config.ts": "export default {};\n",
    "src/features/home/feature.json": manifest("home", { required: true }),
    "src/features/home/routes/index.tsx": "export const Route = 1;\n",
    "src/features/core/observability/feature.json": manifest("observability", { required: true }),
    "src/features/core/lib/call.ts": "export const call = 1;\n",
    "src/features/core/db/feature.json": manifest("db", {
      files: ["drizzle.config.ts"],
      packageJson: { dependencies: { "drizzle-orm": "1" } },
    }),
    "src/features/core/db/layer.ts": "export const layer = 1;\n",
    "src/features/auth/feature.json": manifest("auth", { requires: ["db"] }),
    "src/features/core/kv/feature.json": manifest("kv"),
    "src/features/auth-kv/feature.json": manifest("auth-kv", {
      requires: ["auth", "kv"],
      auto: true,
    }),
    "src/features/core/kv/layer.ts": "export const layer = 1;\n",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

describe("removeBlock", () => {
  test("refuses a required feature or core module", () => {
    expect(() => removeBlock(project(), "home")).toThrow(/"home" is required/);
    expect(() => removeBlock(project(), "observability")).toThrow(/"observability" is required/);
  });

  test("refuses a feature another one requires", () => {
    expect(() => removeBlock(project(), "db")).toThrow(/required by auth/);
  });

  test("deletes the feature's or core module's folder and its files", () => {
    const root = project();
    removeBlock(root, "auth", { force: true });
    removeBlock(root, "db", { force: true });
    expect(existsSync(join(root, "src/features/auth"))).toBe(false);
    expect(existsSync(join(root, "src/features/core/db"))).toBe(false);
    expect(existsSync(join(root, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(root, "src/features/home"))).toBe(true);
    expect(existsSync(join(root, "src/features/core/lib/call.ts"))).toBe(true);
  });
});

describe("removeBlock on an auto feature", () => {
  test("refuses, and names what to remove instead", () => {
    expect(() => removeBlock(project(), "auth-kv", { force: true })).toThrow(
      /"auth-kv" is on because .* are; remove one of those instead/,
    );
  });
});

describe("removeBlock safety", () => {
  test("refuses a files entry outside the project and deletes nothing", () => {
    for (const bad of ["../outside", "", "/", "a/../..", ".git", "node_modules/x"]) {
      const root = project();
      writeFileSync(
        join(root, "src/features/core/kv/feature.json"),
        manifest("kv", { files: [bad] }),
      );
      expect(() => removeBlock(root, "kv", { force: true })).toThrow(/"files" entry/);
      expect(existsSync(join(root, "src/features/core/kv/layer.ts"))).toBe(true);
    }
  });

  test("keeps a path another feature owns too", () => {
    const root = project();
    const files = ["drizzle.config.ts"];
    writeFileSync(join(root, "src/features/core/kv/feature.json"), manifest("kv", { files }));
    removeBlock(root, "kv", { force: true });
    expect(existsSync(join(root, "src/features/core/kv"))).toBe(false);
    expect(existsSync(join(root, "drizzle.config.ts"))).toBe(true);
  });

  test("deletes nothing when the project cannot be synced afterwards", () => {
    const root = project();
    writeFileSync(join(root, "wrangler.jsonc"), '{ "name": "app" ');
    expect(() => removeBlock(root, "kv", { force: true })).toThrow(/wrangler.jsonc/);
    expect(existsSync(join(root, "src/features/core/kv/layer.ts"))).toBe(true);
  });
});

describe("removeBlock without force", () => {
  const git = (root: string, ...args: Array<string>) =>
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root });

  test("refuses outside a git repository and deletes nothing", () => {
    const root = project();
    expect(() => removeBlock(root, "kv")).toThrow(/not a git repository/);
    expect(existsSync(join(root, "src/features/core/kv/layer.ts"))).toBe(true);
  });

  test("refuses uncommitted work in the feature, then removes it once committed", () => {
    const root = project();
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");
    writeFileSync(join(root, "src/features/core/kv/layer.ts"), "export const layer = 2;\n");
    expect(() => removeBlock(root, "kv")).toThrow(/kv has uncommitted changes/);
    expect(existsSync(join(root, "src/features/core/kv/layer.ts"))).toBe(true);
    git(root, "commit", "-qam", "edit");
    removeBlock(root, "kv");
    expect(existsSync(join(root, "src/features/core/kv"))).toBe(false);
  });
});

describe("addBlock", () => {
  test("copies nothing when the project cannot be synced", () => {
    const template = project();
    const root = project();
    removeBlock(root, "kv", { force: true });
    writeFileSync(join(root, "wrangler.jsonc"), '{ "name": "app" ');
    expect(() => addBlock(root, template, "kv")).toThrow(/wrangler.jsonc/);
    expect(existsSync(join(root, "src/features/core/kv"))).toBe(false);
  });

  test("refuses to overwrite a file the project already has", () => {
    const template = project();
    const root = project();
    removeBlock(root, "auth", { force: true });
    removeBlock(root, "db", { force: true });
    writeFileSync(join(root, "drizzle.config.ts"), "mine\n");
    expect(() => addBlock(root, template, "db")).toThrow(/already exist: .*drizzle\.config\.ts/);
    expect(readFileSync(join(root, "drizzle.config.ts"), "utf8")).toBe("mine\n");
    expect(existsSync(join(root, "src/features/core/db"))).toBe(false);
  });

  test("copies nothing when a name clashes with an enabled feature", () => {
    const template = project();
    const root = project();
    removeBlock(root, "kv", { force: true });
    const vars = { KEY: { description: "x", required: false } };
    writeFileSync(join(template, "src/features/core/kv/feature.json"), manifest("kv", { vars }));
    writeFileSync(join(root, "src/features/auth/feature.json"), manifest("auth", { vars }));
    expect(() => addBlock(root, template, "kv")).toThrow(/"KEY" is declared by both/);
    expect(existsSync(join(root, "src/features/core/kv"))).toBe(false);
  });

  test("adds beside a feature the project wrote itself", () => {
    const template = project();
    const root = project();
    removeBlock(root, "kv", { force: true });
    mkdirSync(join(root, "src/features/invoices"), { recursive: true });
    writeFileSync(
      join(root, "src/features/invoices/feature.json"),
      manifest("invoices", { requires: ["auth"] }),
    );
    expect(addBlock(root, template, "kv")).toEqual(["kv", "auth-kv"]);
  });

  test("puts a core module back in core, with what it requires", () => {
    const template = project();
    const root = project();
    removeBlock(root, "auth", { force: true });
    removeBlock(root, "db", { force: true });
    removeBlock(root, "kv", { force: true });
    expect(addBlock(root, template, "auth")).toEqual(["db", "auth"]);
    expect(existsSync(join(root, "src/features/core/db/layer.ts"))).toBe(true);
    expect(existsSync(join(root, "src/features/db"))).toBe(false);
    expect(addBlock(root, template, "kv")).toEqual(["kv", "auth-kv"]);
    expect(readFileSync(join(root, "src/gen/layers.ts"), "utf8")).toContain(
      'import { layer as kv } from "../features/core/kv/layer.ts";',
    );
  });

  test("an auto feature leaves with either feature it needs, and blocks neither", () => {
    const root = project();
    removeBlock(root, "kv", { force: true });
    expect(existsSync(join(root, "src/features/auth-kv"))).toBe(false);
    expect(existsSync(join(root, "src/features/auth"))).toBe(true);
  });
});

describe("check on a CRLF checkout", () => {
  test("generated files with CRLF are not stale", () => {
    const root = project();
    sync(root);
    for (const path of plan(root).files.keys()) {
      const full = join(root, path);
      writeFileSync(full, readFileSync(full, "utf8").replaceAll("\n", "\r\n"));
    }
    const stale = check(root).filter((p) => /out of date|missing/.test(p.message));
    expect(stale).toEqual([]);
    expect(sync(root)).toEqual([]);
  });
});

describe("prune", () => {
  test("keeps required ones plus the selection and what it requires", () => {
    const root = project();
    expect(prune(root, ["auth"])).toEqual(["db", "auth"]);
    expect(existsSync(join(root, "src/features/core/kv"))).toBe(false);
    expect(existsSync(join(root, "src/features/core/db"))).toBe(true);
    expect(existsSync(join(root, "src/features/core/observability"))).toBe(true);
    expect(existsSync(join(root, "src/features/core/lib/call.ts"))).toBe(true);
    expect(existsSync(join(root, "src/features/home"))).toBe(true);
    expect(existsSync(join(root, "src/gen/routes.ts"))).toBe(true);
  });
});
