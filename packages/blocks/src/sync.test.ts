import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { boundaryProblems, ownerOf } from "./sync.ts";

const manifest = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, title: name, description: name, requires: [], ...extra });

/** A project with four features: two core, `db`, and `auth` which requires `db`. */
const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-blocks-"));
  const all: Record<string, string> = {
    "src/features/ui/feature.json": manifest("ui", { core: true }),
    "src/features/ui/components/button.tsx": "export const Button = 1;\n",
    "src/features/consent/feature.json": manifest("consent", { core: true }),
    "src/features/db/feature.json": manifest("db"),
    "src/features/db/api/database.ts": "export const db = 1;\n",
    "src/features/auth/feature.json": manifest("auth", { requires: ["db"] }),
    "src/features/auth/api/auth.ts": "export const auth = 1;\n",
    "src/features/kv/feature.json": manifest("kv"),
    "src/features/kv/api/key-value.ts": "export const kv = 1;\n",
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
    .sort();

describe("ownerOf", () => {
  test("names the feature, the app, gen, or no one", () => {
    expect(ownerOf("src/features/auth/routes/login.tsx")).toBe("auth");
    expect(ownerOf("src/app/runtime.ts")).toBe("app");
    expect(ownerOf("src/routes/__root.tsx")).toBe("app");
    expect(ownerOf("src/server.ts")).toBe("app");
    expect(ownerOf("src/gen/routes.ts")).toBe("gen");
    expect(ownerOf("src/routeTree.gen.ts")).toBe("gen");
    expect(ownerOf("src/routes/index.tsx")).toBeUndefined();
    expect(ownerOf("src/lib/cn.ts")).toBeUndefined();
  });
});

describe("boundaryProblems", () => {
  test("a clean project has none", () => {
    expect(messages(project({}))).toEqual([]);
  });

  test("the app may import itself, src/gen and core features, but no optional feature", () => {
    const root = project({
      "src/app/shell.ts": [
        'import { errors } from "./errors.ts";',
        'import { Button } from "#/features/ui/components/button.tsx";',
        'import { auth } from "#/gen/layers.ts";',
        'import { db } from "#/features/db/api/database.ts";',
      ].join("\n"),
      "src/routes/__root.tsx": 'import { kv } from "../features/kv/api/key-value.ts";\n',
    });
    expect(messages(root)).toEqual([
      'src/app/shell.ts: the app imports feature "db"; src/app and the files at the top of src may import only the app, src/gen and core features (#/features/db/api/database.ts)',
      'src/routes/__root.tsx: the app imports feature "kv"; src/app and the files at the top of src may import only the app, src/gen and core features (../features/kv/api/key-value.ts)',
    ]);
  });

  test("a core feature may import the app, src/gen and core features, but no optional feature", () => {
    const root = project({
      "src/features/consent/components/banner.tsx": [
        'import { Button } from "#/features/ui/components/button.tsx";',
        'import { errors } from "#/app/errors.ts";',
        'import { auth } from "#/features/auth/api/auth.ts";',
      ].join("\n"),
    });
    expect(messages(root)).toEqual([
      'src/features/consent/components/banner.tsx: core feature "consent" imports feature "auth"; core features may import only the app, src/gen and core features (#/features/auth/api/auth.ts)',
    ]);
  });

  test("an optional feature may import core features and what it requires, transitively", () => {
    const root = project({
      "src/features/billing/feature.json": manifest("billing", { requires: ["auth"] }),
      "src/features/billing/api/billing.ts": [
        'import { Button } from "#/features/ui/components/button.tsx";',
        'import { auth } from "#/features/auth/api/auth.ts";',
        'import { db } from "../../db/api/database.ts";',
        'import { kv } from "#/features/kv/api/key-value.ts";',
      ].join("\n"),
    });
    expect(messages(root)).toEqual([
      'src/features/billing/api/billing.ts: feature "billing" imports feature "kv" without listing it in "requires" (#/features/kv/api/key-value.ts)',
    ]);
  });

  test("reports files with no owner and feature folders with no manifest", () => {
    const root = project({
      "src/lib/cn.ts": "export const cn = 1;\n",
      "src/routes/index.tsx": "export const Route = 1;\n",
      "src/features/ghost/api/ghost.ts": "export const ghost = 1;\n",
      "src/styles.css": "body {}\n",
    });
    expect(messages(root)).toEqual([
      'src/features/ghost/api/ghost.ts: belongs to feature "ghost", which has no src/features/ghost/feature.json',
      "src/lib/cn.ts: has no owner; move it into src/app or a feature under src/features",
      "src/routes/index.tsx: has no owner; move it into src/app or a feature under src/features",
    ]);
  });
});
