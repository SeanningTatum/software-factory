import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { devVarsExample, enabledOrder, generateFiles } from "./generate.ts";
import type { BlockManifest } from "./manifest.ts";

const feature = (name: string, extra: Partial<BlockManifest> = {}): BlockManifest => ({
  name,
  title: name,
  description: name,
  requires: [],
  ...extra,
});

const manifests = new Map(
  [
    feature("ui", { core: true }),
    feature("home", { core: true, vars: { APP_URL: { description: "url", required: true } } }),
    feature("auth", { requires: ["db"] }),
    feature("db", { secrets: { DB_TOKEN: { description: "token", required: false } } }),
    feature("analytics", { core: true }),
  ].map((m) => [m.name, m]),
);

const project = (files: ReadonlyArray<string>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-gen-"));
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), "export {};\n");
  }
  return root;
};

describe("enabledOrder", () => {
  test("puts core features first, then the rest after what they require", () => {
    expect(enabledOrder(manifests)).toEqual(["analytics", "home", "ui", "db", "auth"]);
  });
});

describe("generateFiles", () => {
  const root = project([
    "src/features/home/routes/index.tsx",
    "src/features/home/nav.ts",
    "src/features/auth/routes/login.tsx",
    "src/features/auth/layer.ts",
    "src/features/db/layer.ts",
    "src/features/ui/components/button.tsx",
  ]);
  const files = generateFiles(root, manifests);

  test("mounts each feature's routes folder, in order", () => {
    expect(files.get("src/gen/routes.ts")).toContain(
      [
        'import { physical, rootRoute } from "@tanstack/virtual-file-routes";',
        "",
        "/** The route tree: the root route plus every enabled feature's routes folder. */",
        'export const routes = rootRoute("__root.tsx", [',
        '  physical("../features/home/routes"),',
        '  physical("../features/auth/routes"),',
        "]);",
      ].join("\n"),
    );
  });

  test("gives a root with no children when no feature has routes", () => {
    const text = generateFiles(project([]), manifests).get("src/gen/routes.ts");
    expect(text).toContain('import { rootRoute } from "@tanstack/virtual-file-routes";');
    expect(text).toContain('export const routes = rootRoute("__root.tsx", []);');
  });

  test("gathers contributions from feature folders", () => {
    expect(files.get("src/gen/layers.ts")).toContain(
      "export const FeaturesLayer = auth.pipe(Layer.provideMerge(db));",
    );
    expect(files.get("src/gen/nav.ts")).toContain(
      'import { nav as home } from "../features/home/nav.ts";',
    );
  });

  test("lists secrets and required settings from every feature, core ones included", () => {
    const env = files.get("src/gen/env.ts");
    expect(env).toContain('export type SecretName = "DB_TOKEN";');
    expect(env).toContain('export const requiredSettings = ["APP_URL"] as const;');
    expect(devVarsExample(manifests)).toContain("# --- home ---\n# url (required).\nAPP_URL=");
  });
});
