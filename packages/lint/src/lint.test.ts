import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defaults } from "./config.ts";
import { globToRegExp } from "./glob.ts";
import { lint } from "./lint.ts";

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-lint-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

describe("glob", () => {
  test("matches nested paths and alternatives", () => {
    expect(globToRegExp("src/{core,blocks}/**/*.ts").test("src/blocks/auth/layer.ts")).toBe(true);
    expect(globToRegExp("src/**/*.ts").test("src/a.ts")).toBe(true);
    expect(globToRegExp("src/*.ts").test("src/a/b.ts")).toBe(false);
    const both = globToRegExp("src/features/{*,core/*}/routes/**");
    expect(both.test("src/features/auth/routes/login.tsx")).toBe(true);
    expect(both.test("src/features/core/kv/routes/api/kv.ts")).toBe(true);
    expect(both.test("src/features/core/kv/lib/x.ts")).toBe(false);
  });
});

describe("lint", () => {
  test("reports throw, try/catch, process.env and unspanned outside calls", () => {
    const root = project({
      "src/core/bad.ts": [
        'import { Effect } from "effect";',
        "export const a = () => { throw new Error('x') };",
        "export const b = () => { try { return 1 } catch { return 2 } };",
        "export const c = process.env.X;",
        "export const d = Effect.tryPromise({ try: () => fetch('x'), catch: (e) => e });",
        'export const e = Effect.fn("e")(function* () { return yield* Effect.tryPromise({ try: () => fetch("x"), catch: (x) => x }) });',
        "export const f = Effect.runPromise(Effect.void);",
      ].join("\n"),
      "src/core/bad.test.ts": "throw new Error('fine in tests')",
    });
    const rules = lint(root).map((f) => `${f.rule}:${f.line}`);
    expect(rules).toEqual([
      "no-throw:2",
      "no-try-catch:3",
      "no-process-env:4",
      "external-call-span:5",
      "no-run-effect:7",
    ]);
  });

  test("requires the tests the test map lists", () => {
    const root = project({
      "src/app/thing.ts": "export const x = 1;",
      "src/features/uploads/feature.json": "{}",
      "src/features/uploads/TIMELINE.md": "",
      "src/features/uploads/components/upload.machine.ts": "export const m = 1;",
      "src/features/uploads/components/upload.machine.test.ts": "",
      "src/features/billing/feature.json": "{}",
      "src/features/billing/TIMELINE.md": "",
      "src/features/billing/components/checkout.machine.ts": "export const m = 1;",
      "src/features/billing/components/checkout.machine.test.ts": "",
      "src/features/billing/e2e/checkout.paths.spec.ts": "",
      "src/features/billing/e2e/upload.paths.spec.ts": "",
    });
    const findings = lint(root).map((f) => `${f.file} ${f.message}`);
    expect(findings).toEqual([
      "src/app/thing.ts missing its test: src/app/thing.test.ts",
      "src/features/uploads/components/upload.machine.ts missing its test: src/features/uploads/e2e/upload.paths.spec.ts",
    ]);
  });

  test("honours the allow list", () => {
    const root = project({
      "src/core/edge.ts": "throw new Error('edge');",
      "src/core/edge.test.ts": "",
    });
    expect(lint(root, { ...defaults, allow: { "no-throw": ["src/core/edge.ts"] } })).toEqual([]);
  });

  test("fills {feature} with a core module's folder", () => {
    const root = project({
      "src/features/core/kv/feature.json": "{}",
      "src/features/core/kv/TIMELINE.md": "",
      "src/features/core/kv/machines/sync.machine.ts": "export const m = 1;",
    });
    const config = {
      ...defaults,
      testMap: [
        {
          files: "src/features/**/*.machine.ts",
          requires: ["src/features/{feature}/machines/{name}.machine.test.ts"],
        },
      ],
    };
    expect(lint(root, config).map((f) => f.message)).toEqual([
      "missing its test: src/features/core/kv/machines/sync.machine.test.ts",
    ]);
  });

  test("keeps services, layers and React out of core/lib, but allows Effect functions", () => {
    const root = project({
      "src/features/core/lib/call.ts": [
        'import { Context, Effect, Layer } from "effect";',
        'import { useState } from "react";',
        'export const call = Effect.fn("call")(function* () {});',
        'export class S extends Context.Service<S, {}>()("S") {}',
        "export const l = Layer.empty;",
      ].join("\n"),
      "src/features/core/lib/call.test.ts": "",
    });
    expect(
      lint(root).map((f) => `${f.rule}:${f.line} ${f.message.slice(0, f.message.indexOf(";"))}`),
    ).toEqual([
      "shared-lib:2 imports React (react)",
      "shared-lib:4 uses Context.Service",
      "shared-lib:5 uses Layer.empty",
    ]);
  });
});
