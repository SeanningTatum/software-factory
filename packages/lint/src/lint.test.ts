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
    expect(rules).toEqual(["no-throw:2", "no-try-catch:3", "no-process-env:4", "external-call-span:5", "no-run-effect:7"]);
  });

  test("requires the tests the test map lists", () => {
    const root = project({
      "src/core/thing.ts": "export const x = 1;",
      "src/blocks/upload/ui/upload.machine.ts": "export const m = 1;",
      "src/blocks/upload/ui/upload.machine.test.ts": "",
    });
    const findings = lint(root).map((f) => `${f.file} ${f.message}`);
    expect(findings).toEqual([
      "src/blocks/upload/ui/upload.machine.ts missing its test: e2e/**/upload.paths.spec.ts",
      "src/core/thing.ts missing its test: src/core/thing.test.ts",
    ]);
  });

  test("honours the allow list", () => {
    const root = project({ "src/core/edge.ts": "throw new Error('edge');", "src/core/edge.test.ts": "" });
    expect(lint(root, { ...defaults, allow: { "no-throw": ["src/core/edge.ts"] } })).toEqual([]);
  });
});
