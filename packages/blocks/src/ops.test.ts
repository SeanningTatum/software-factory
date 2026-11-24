import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { addBlock, prune, removeBlock } from "./ops.ts";

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
    removeBlock(root, "auth");
    removeBlock(root, "db");
    expect(existsSync(join(root, "src/features/auth"))).toBe(false);
    expect(existsSync(join(root, "src/features/core/db"))).toBe(false);
    expect(existsSync(join(root, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(root, "src/features/home"))).toBe(true);
    expect(existsSync(join(root, "src/features/core/lib/call.ts"))).toBe(true);
  });
});

describe("addBlock", () => {
  test("puts a core module back in core, with what it requires", () => {
    const template = project();
    const root = project();
    removeBlock(root, "auth");
    removeBlock(root, "db");
    removeBlock(root, "kv");
    expect(addBlock(root, template, "auth")).toEqual(["db", "auth"]);
    expect(existsSync(join(root, "src/features/core/db/layer.ts"))).toBe(true);
    expect(existsSync(join(root, "src/features/db"))).toBe(false);
    expect(addBlock(root, template, "kv")).toEqual(["kv"]);
    expect(readFileSync(join(root, "src/gen/layers.ts"), "utf8")).toContain(
      'import { layer as kv } from "../features/core/kv/layer.ts";',
    );
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
