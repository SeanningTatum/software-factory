import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { devVarsExample, enabledOrder, generateFiles } from "./generate.ts";
import type { BlockManifest, Feature } from "./manifest.ts";

const feature = (name: string, extra: Partial<BlockManifest> = {}, core = false): Feature => ({
  name,
  title: name,
  description: name,
  requires: [],
  dir: core ? `src/features/core/${name}` : `src/features/${name}`,
  ...extra,
});

/** `ui`, `analytics` and `db` are core modules; `home` and `auth` are features. */
const manifests = new Map(
  [
    feature("ui", { required: true }, true),
    feature("home", { required: true, vars: { APP_URL: { description: "url", required: true } } }),
    feature("auth", { requires: ["db"] }),
    feature("db", { secrets: { DB_TOKEN: { description: "token", required: false } } }, true),
    feature("analytics", { required: true }, true),
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

describe("generated names", () => {
  test("a feature named like a keyword still generates code that parses", () => {
    const root = project(["src/features/export/layer.ts", "src/features/export/nav.ts"]);
    const files = generateFiles(root, new Map([["export", feature("export")]]));
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    for (const text of files.values()) expect(() => transpiler.transformSync(text)).not.toThrow();
    expect(files.get("src/gen/nav.ts")).toContain("nav as exportFeature");
  });
});

describe("enabledOrder", () => {
  test("puts required features first, then the rest after what they require", () => {
    expect(enabledOrder(manifests)).toEqual(["analytics", "home", "ui", "db", "auth"]);
  });
});

describe("generateFiles", () => {
  const root = project([
    "src/features/home/routes/index.tsx",
    "src/features/home/nav.ts",
    "src/features/auth/routes/login.tsx",
    "src/features/auth/layer.ts",
    "src/features/core/db/layer.ts",
    "src/features/core/analytics/routes/api/events.ts",
    "src/features/core/ui/components/button.tsx",
  ]);
  const files = generateFiles(root, manifests);

  test("mounts each feature's routes folder, in order", () => {
    expect(files.get("src/gen/routes.ts")).toContain(
      [
        'import { physical, rootRoute } from "@tanstack/virtual-file-routes";',
        "",
        "/** The route tree: the root route plus every enabled feature's routes folder. */",
        'export const routes = rootRoute("__root.tsx", [',
        '  physical("../features/core/analytics/routes"),',
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

  test("hands Better Auth the tables of a feature that adds auth plugins", () => {
    const billing = feature("billing", { requires: ["auth"] });
    const withBilling = new Map([...manifests, ["billing", billing]]);
    const both = ["src/features/billing/auth-plugins.ts", "src/features/billing/schema.ts"];
    const text = generateFiles(project(both), withBilling).get("src/gen/auth-plugins.ts");
    expect(text).toContain('import * as billingTables from "../features/billing/schema.ts";');
    expect(text).toContain("export const featureAuthTables = { ...billingTables };");
    // A feature with plugins and no tables, and a project with no such feature, give it nothing.
    const none = generateFiles(project(both.slice(0, 1)), withBilling).get(
      "src/gen/auth-plugins.ts",
    );
    expect(none).toContain("export const featureAuthTables = {};");
  });

  test("gathers contributions from feature folders and core modules", () => {
    expect(files.get("src/gen/layers.ts")).toContain(
      'import { layer as db } from "../features/core/db/layer.ts";',
    );
    expect(files.get("src/gen/layers.ts")).toContain(
      "export const FeaturesLayer = auth.pipe(Layer.provideMerge(db));",
    );
    expect(files.get("src/gen/nav.ts")).toContain(
      'import { nav as home } from "../features/home/nav.ts";',
    );
  });

  test("lists secrets and required settings from every feature, required ones included", () => {
    const env = files.get("src/gen/env.ts");
    expect(env).toContain('export type SecretName = "DB_TOKEN";');
    expect(env).toContain('export const requiredSettings = ["APP_URL"] as const;');
    expect(devVarsExample(manifests)).toContain("# --- home ---\n# url (required).\nAPP_URL=");
  });

  test("shows a var's example in .dev.vars.example, not its deployed default", () => {
    const withExample = new Map(manifests).set(
      "home",
      feature("home", {
        required: true,
        vars: { KEY: { description: "key", required: false, default: "", example: "test-key" } },
      }),
    );
    expect(devVarsExample(withExample)).toContain("KEY=test-key");
  });
});
