import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { prune, removeBlock } from "./ops.ts";

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
    "src/features/home/feature.json": manifest("home", { core: true }),
    "src/features/home/routes/index.tsx": "export const Route = 1;\n",
    "src/features/db/feature.json": manifest("db", {
      files: ["drizzle.config.ts"],
      packageJson: { dependencies: { "drizzle-orm": "1" } },
    }),
    "src/features/db/layer.ts": "export const layer = 1;\n",
    "src/features/auth/feature.json": manifest("auth", { requires: ["db"] }),
    "src/features/kv/feature.json": manifest("kv"),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

describe("removeBlock", () => {
  test("refuses a core feature", () => {
    expect(() => removeBlock(project(), "home")).toThrow(/core feature/);
  });

  test("refuses a feature another one requires", () => {
    expect(() => removeBlock(project(), "db")).toThrow(/required by auth/);
  });

  test("deletes the feature's folder and its files", () => {
    const root = project();
    removeBlock(root, "auth");
    removeBlock(root, "db");
    expect(existsSync(join(root, "src/features/db"))).toBe(false);
    expect(existsSync(join(root, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(root, "src/features/home"))).toBe(true);
  });
});

describe("prune", () => {
  test("keeps core features plus the selection and what it requires", () => {
    const root = project();
    expect(prune(root, ["auth"])).toEqual(["db", "auth"]);
    expect(existsSync(join(root, "src/features/kv"))).toBe(false);
    expect(existsSync(join(root, "src/features/home"))).toBe(true);
    expect(existsSync(join(root, "src/gen/routes.ts"))).toBe(true);
  });
});
