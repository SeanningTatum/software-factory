import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadManifests } from "./manifest.ts";
import { byCodeUnit } from "./order.ts";
import { boundaryProblems, ownerOf } from "./sync.ts";

const manifest = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, title: name, description: name, requires: [], ...extra });

/**
 * Core modules: required `ui`, optional `db` and `kv`, and the shared helpers in core/lib.
 * Features: required `consent`, and `auth` which requires `db`.
 */
const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "software-factory-blocks-"));
  const all: Record<string, string> = {
    "src/features/core/ui/feature.json": manifest("ui", { required: true }),
    "src/features/core/ui/components/button.tsx": "export const Button = 1;\n",
    "src/features/core/db/feature.json": manifest("db"),
    "src/features/core/db/api/database.ts": "export const db = 1;\n",
    "src/features/core/kv/feature.json": manifest("kv"),
    "src/features/core/kv/api/key-value.ts": 'import { call } from "../../lib/call.ts";\n',
    "src/features/core/lib/call.ts": 'import { errors } from "#/app/errors.ts";\n',
    "src/features/consent/feature.json": manifest("consent", { required: true }),
    "src/features/auth/feature.json": manifest("auth", { requires: ["db"] }),
    "src/features/auth/api/auth.ts": [
      'import { db } from "#/features/core/db/api/database.ts";',
      'import { call } from "#/features/core/lib/call.ts";',
    ].join("\n"),
    "src/app/errors.ts": "export const errors = 1;\n",
    "src/gen/layers.ts": 'import { auth } from "../features/auth/api/auth.ts";\n',
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

const messages = (root: string) =>
  boundaryProblems(root)
    .map((p) => `${p.file}: ${p.message}`)
    .sort(byCodeUnit);

describe("ownerOf", () => {
  test("names the feature or core module, the app, gen, core/lib, or no one", () => {
    expect(ownerOf("src/features/auth/routes/login.tsx")).toBe("auth");
    expect(ownerOf("src/features/core/kv/api/key-value.ts")).toBe("kv");
    expect(ownerOf("src/features/core/lib/call.ts")).toBe("core/lib");
    expect(ownerOf("src/features/core/stray.ts")).toBeUndefined();
    expect(ownerOf("src/app/runtime.ts")).toBe("app");
    expect(ownerOf("src/routes/__root.tsx")).toBe("app");
    expect(ownerOf("src/server.ts")).toBe("app");
    expect(ownerOf("src/gen/routes.ts")).toBe("gen");
    expect(ownerOf("src/routeTree.gen.ts")).toBe("gen");
    expect(ownerOf("src/routes/index.tsx")).toBeUndefined();
    expect(ownerOf("src/lib/cn.ts")).toBeUndefined();
  });
});

describe("loadManifests", () => {
  test("finds features at both levels and resolves each folder by name", () => {
    const features = loadManifests(project({}));
    expect(features.get("db")?.dir).toBe("src/features/core/db");
    expect(features.get("auth")?.dir).toBe("src/features/auth");
    expect([...features.keys()].sort((a, b) => a.localeCompare(b))).toEqual([
      "auth",
      "consent",
      "db",
      "kv",
      "ui",
    ]);
  });

  test("refuses a name the generated code cannot use", () => {
    const root = project({ "src/features/2fa/feature.json": manifest("2fa") });
    expect(() => loadManifests(root)).toThrow(/lower-case words/);
  });

  test("refuses reserved names, a name used twice and the old core flag", () => {
    expect(() =>
      loadManifests(project({ "src/features/lib/feature.json": manifest("lib") })),
    ).toThrow(/reserved name/);
    expect(() =>
      loadManifests(project({ "src/features/db/feature.json": manifest("db") })),
    ).toThrow(/feature names are unique/);
    expect(() =>
      loadManifests(
        project({ "src/features/home/feature.json": manifest("home", { core: true }) }),
      ),
    ).toThrow(/"core" is now "required"/);
  });
});

describe("boundaryProblems", () => {
  test("a clean project has none", () => {
    expect(messages(project({}))).toEqual([]);
  });

  test("sees side-effect, require and literal dynamic imports, not ones in comments or strings", () => {
    const root = project({
      "src/features/consent/lib/a.ts": [
        'import "#/features/auth/api/auth.ts";',
        'import x = require("../../core/kv/api/key-value.ts");',
        "const m = await import(`../../auth/api/auth.ts`);",
        '// import { db } from "#/features/core/db/api/database.ts"',
        "export const s = \"import { db } from '#/features/core/db/api/database.ts'\";",
      ].join("\n"),
    });
    expect(messages(root).map((m) => m.slice(m.lastIndexOf("(")))).toEqual([
      "(#/features/auth/api/auth.ts)",
      "(../../auth/api/auth.ts)",
      "(../../core/kv/api/key-value.ts)",
    ]);
  });

  test("the app may import itself, src/gen and required features, but no optional one", () => {
    const root = project({
      "src/app/shell.ts": [
        'import { errors } from "./errors.ts";',
        'import { Button } from "#/features/core/ui/components/button.tsx";',
        'import { auth } from "#/gen/layers.ts";',
        'import { db } from "#/features/core/db/api/database.ts";',
      ].join("\n"),
      "src/routes/__root.tsx": 'import { kv } from "../features/core/kv/api/key-value.ts";\n',
    });
    expect(messages(root)).toEqual([
      'src/app/shell.ts: the app imports feature "db"; src/app and the files at the top of src may import only the app, src/gen and required features (#/features/core/db/api/database.ts)',
      'src/routes/__root.tsx: the app imports feature "kv"; src/app and the files at the top of src may import only the app, src/gen and required features (../features/core/kv/api/key-value.ts)',
    ]);
  });

  test("core/lib imports nothing from features or src/gen", () => {
    const root = project({
      "src/features/core/lib/call.ts": [
        'import { errors } from "#/app/errors.ts";',
        'import { auth } from "#/features/auth/api/auth.ts";',
        'import { Button } from "../ui/components/button.tsx";',
        'import { layers } from "#/gen/layers.ts";',
      ].join("\n"),
    });
    expect(messages(root)).toEqual([
      "src/features/core/lib/call.ts: src/features/core/lib imports auth; src/features/core/lib may import only src/app (#/features/auth/api/auth.ts)",
      "src/features/core/lib/call.ts: src/features/core/lib imports gen; src/features/core/lib may import only src/app (#/gen/layers.ts)",
      "src/features/core/lib/call.ts: src/features/core/lib imports ui; src/features/core/lib may import only src/app (../ui/components/button.tsx)",
    ]);
  });

  test("a core module imports core modules it may use, never a feature outside core", () => {
    const root = project({
      "src/features/core/db/api/database.ts": [
        'import { Button } from "#/features/core/ui/components/button.tsx";',
        'import { call } from "#/features/core/lib/call.ts";',
        'import { auth } from "#/features/auth/api/auth.ts";',
        'import { kv } from "../../kv/api/key-value.ts";',
      ].join("\n"),
    });
    expect(messages(root)).toEqual([
      'src/features/core/db/api/database.ts: core module "db" imports feature "auth", which is outside core; nothing in src/features/core imports a feature outside it (#/features/auth/api/auth.ts)',
      'src/features/core/db/api/database.ts: core module "db" imports optional module "kv" without listing it in "requires"; a core module may import only the app, src/gen, core/lib and other core modules (an optional one only if it is in "requires") (../../kv/api/key-value.ts)',
    ]);
  });

  test("a required feature outside core is still out of reach for core modules", () => {
    const root = project({
      "src/features/core/ui/components/footer.tsx":
        'import { useConsent } from "#/features/consent/components/banner.tsx";\n',
    });
    expect(messages(root)).toEqual([
      'src/features/core/ui/components/footer.tsx: core module "ui" imports feature "consent", which is outside core; nothing in src/features/core imports a feature outside it (#/features/consent/components/banner.tsx)',
    ]);
  });

  test("a feature may import required ones, core/lib and what it requires, transitively", () => {
    const root = project({
      "src/features/billing/feature.json": manifest("billing", { requires: ["auth"] }),
      "src/features/billing/api/billing.ts": [
        'import { Button } from "#/features/core/ui/components/button.tsx";',
        'import { auth } from "#/features/auth/api/auth.ts";',
        'import { db } from "../../core/db/api/database.ts";',
        'import { call } from "#/features/core/lib/call.ts";',
        'import { kv } from "#/features/core/kv/api/key-value.ts";',
      ].join("\n"),
    });
    expect(messages(root)).toEqual([
      'src/features/billing/api/billing.ts: feature "billing" imports feature "kv" without listing it in "requires" (#/features/core/kv/api/key-value.ts)',
    ]);
  });

  test("reports files with no owner, folders with no manifest, and a feature in the wrong place", () => {
    const root = project({
      "src/lib/cn.ts": "export const cn = 1;\n",
      "src/routes/index.tsx": "export const Route = 1;\n",
      "src/features/ghost/api/ghost.ts": "export const ghost = 1;\n",
      "src/features/core/stray.ts": "export const stray = 1;\n",
      "src/features/kv/api/old.ts": "export const old = 1;\n",
      "src/styles.css": "body {}\n",
    });
    expect(messages(root)).toEqual([
      "src/features/core/stray.ts: has no owner; put it in a module under src/features/core or in src/features/core/lib",
      'src/features/ghost/api/ghost.ts: belongs to feature "ghost", which has no src/features/ghost/feature.json',
      'src/features/kv/api/old.ts: belongs to feature "kv", which has no src/features/kv/feature.json; "kv" lives in src/features/core/kv',
      "src/lib/cn.ts: has no owner; move it into src/app or a feature under src/features",
      "src/routes/index.tsx: has no owner; move it into src/app or a feature under src/features",
    ]);
  });
});
