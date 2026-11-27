import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defaults } from "./config.ts";
import { importSpecifiers, toSlash } from "./files.ts";
import { globToRegExp } from "./glob.ts";
import { lint } from "./lint.ts";

/** A project of these files, and one empty test file so that lint always has a file to read. */
const project = (
  files: Record<string, string>,
  base: Record<string, string> = { "src/a.test.ts": "" },
) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-lint-"));
  for (const [path, text] of Object.entries({ ...base, ...files })) {
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

  test("reads an unclosed brace as a literal instead of looping forever", () => {
    expect(globToRegExp("src/{app,features/*.ts").test("src/{app,features/a.ts")).toBe(true);
  });
});

describe("files", () => {
  test("turns Windows separators into slashes", () => {
    expect(toSlash("src\\features\\auth\\a.ts", "\\")).toBe("src/features/auth/a.ts");
  });

  test("finds every import form and nothing in comments or strings", () => {
    const text = [
      'import "#/features/uploads/side.ts";',
      'import x = require("./required.ts");',
      "const m = await import(`./template.ts`);",
      'const n = await import("./options.ts", { with: {} });',
      'export * from "./star.ts";',
      'import type { T } from "./types.ts";',
      '// import { a } from "./comment.ts"',
      "export const s = \"import { b } from './string.ts'\";",
    ].join("\n");
    expect(importSpecifiers(text)).toEqual([
      "#/features/uploads/side.ts",
      "./required.ts",
      "./template.ts",
      "./options.ts",
      "./star.ts",
      "./types.ts",
    ]);
  });
});

describe("lint", () => {
  test("fails a CLAUDE.md over the line limit and passes one at it", () => {
    const at = "rule\n".repeat(defaults.maxRulesLines);
    expect(lint(project({ "CLAUDE.md": at }))).toEqual([]);
    expect(lint(project({ "CLAUDE.md": `${at}one more\n` })).map((f) => f.rule)).toEqual([
      "rules-file",
    ]);
  });

  test("fails when no file matches include, so a run in the wrong folder is not a pass", () => {
    expect(lint(project({ "lib/a.ts": "" }, {})).map((f) => f.rule)).toEqual(["no-files"]);
  });

  test("counts lines, not the final newline", () => {
    const at = "// a line\n".repeat(defaults.maxLines);
    const rulesOf = (text: string) => lint(project({ "src/big.test.ts": text })).map((f) => f.rule);
    expect(rulesOf(at)).toEqual([]);
    expect(rulesOf(`${at}// one more`)).toEqual(["file-size"]);
  });

  describe("CLAUDE.md is true", () => {
    const files = {
      "package.json": '{"scripts":{"test":"x","blocks:sync":"y"}}',
      "docs/a.md": "",
    };
    const messages = (md: string) =>
      lint(project({ ...files, "CLAUDE.md": md })).map((f) => f.message);

    test("passes paths, scripts and rules that exist, and skips placeholders", () => {
      const md = [
        "See `docs/a.md`, `docs/`; run `bun run test` or `bun run blocks:sync`.",
        "The `no-throw` rule and (rule `shared-lib`) exist. Skipped: `src/features/<name>/`,",
        "`src/**/*.ts`, `src/{a,b}.ts`, `routes/api/`, `bun run`, `origin/<base>`,",
        "a route `/docs/x` and a relative `../docs/x`.",
      ].join("\n");
      expect(messages(md)).toEqual([]);
    });

    test("names the missing path, unknown script and unknown rule", () => {
      expect(messages("See `docs/gone.md`.")).toEqual(["`docs/gone.md` does not exist"]);
      expect(messages("Run `bun run nope`.")).toEqual([
        '`bun run nope`: package.json has no script "nope"',
      ]);
      expect(messages("The rule `no-such-rule` bites.")).toEqual([
        "rule `no-such-rule` is not a cf-saas-lint rule",
      ]);
    });
  });

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

  test("sees runners, outside calls and process.env through aliases and destructuring", () => {
    const root = project({
      "src/core/sneaky.ts": [
        'import { Effect as E } from "effect";',
        'import { runPromise } from "effect/Effect";',
        "const { env } = process;",
        "export const a = () => E.runPromise(E.succeed(env.X));",
        "export const b = () => runPromise(E.succeed(process?.env.Y));",
        'export const c = () => E.tryPromise(() => fetch("https://x"));',
        "export const d = globalThis.process.env.Z;",
        'export const e = process["env"].W;',
        'export const f = E.fn("f")(function* () { return yield* E.tryPromise(() => fetch("x")) });',
        "export const g = (xs: Array<never>) => xs.map(E.runSync);",
        "export const h = E.runPromiseExitWith;",
      ].join("\n"),
      "src/core/sneaky.test.ts": "",
    });
    expect(lint(root).map((f) => `${f.rule}:${f.line}`)).toEqual([
      "no-run-effect:2",
      "no-process-env:3",
      "no-run-effect:4",
      "no-run-effect:5",
      "no-process-env:5",
      "external-call-span:6",
      "no-process-env:7",
      "no-process-env:8",
      "no-run-effect:10",
      "no-run-effect:11",
    ]);
  });

  test("reports a yield inside another yield, in source and in tests, but not across a function", () => {
    const body = [
      'import { Effect } from "effect";',
      "export const a = Effect.gen(function* () {",
      "  return yield* (yield* Service).get();",
      "});",
      "export const b = Effect.gen(function* () {",
      "  const service = yield* Service;",
      "  return yield* Effect.gen(function* () { return yield* service.get(); });",
      "});",
    ].join("\n");
    const root = project({ "src/core/nested.ts": body, "src/core/nested.test.ts": body });
    expect(lint(root).map((f) => `${f.file}:${f.rule}:${f.line}`)).toEqual([
      "src/core/nested.test.ts:no-nested-yield:3",
      "src/core/nested.ts:no-nested-yield:3",
    ]);
  });

  test("reports an inline function passed to a JSX prop, but not a named one or one in a test", () => {
    const body = [
      "export const A = ({ go }: { go: () => void }) => (",
      "  <div onClick={go} title={String(go)}>",
      "    <button onClick={() => go()} />",
      "    <form onSubmit={(function (e) { e.preventDefault(); })} />",
      "  </div>",
      ");",
    ].join("\n");
    const root = project({ "src/core/a.tsx": body, "src/core/a.test.tsx": body });
    expect(lint(root).map((f) => `${f.file}:${f.rule}:${f.line}`)).toEqual([
      "src/core/a.tsx:no-inline-handler:3",
      "src/core/a.tsx:no-inline-handler:4",
    ]);
  });

  test("reports commented-out code, TODOs, dividers and empty comments, not prose or directives", () => {
    const body = [
      "// const old = compute();",
      "// if (old) {",
      "//   send(old);",
      "// }",
      "",
      "// TODO: make this faster",
      "// ---- Helpers ----",
      "//",
      '/// <reference types="vite/client" />',
      "// A 5 MB file plus form overhead; the upload route cuts the exact limit itself.",
      "/** Runs `go()` once; see `retry` for the rest. */",
      "",
      "// Uses `a = b`",
      "",
      "// note: x = 1",
      "",
      "// e.g. foo(bar)",
      "",
      "// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not everywhere.",
      "export const x = 1; // shortcut: one try only, retry once users see failures",
    ].join("\n");
    const root = project({ "src/core/c.ts": body });
    expect(lint(root).map((f) => `${f.rule}:${f.line}`)).toEqual([
      "no-useless-comment:1",
      "no-useless-comment:6",
      "no-useless-comment:7",
      "no-useless-comment:8",
    ]);
  });

  test("reports a comment said again in another place, but not a short one", () => {
    const said = "/** The part of a KV binding the service uses. */\nexport const a = 1;\n";
    const short = "// As above.\nexport const b = 1;\n";
    const root = project({ "src/core/a.ts": said + short, "src/core/b.ts": short + said });
    expect(lint(root).map((f) => `${f.file}:${f.rule}:${f.line}`)).toEqual([
      "src/core/b.ts:no-duplicate-comment:3",
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

  test("requires a route spec, even for routes the test exemption covers", () => {
    const config = {
      ...defaults,
      testExempt: [...defaults.testExempt, "src/features/**/routes/**"],
    };
    const root = project({
      "src/features/auth/feature.json": "{}",
      "src/features/auth/TIMELINE.md": "",
      "src/features/auth/routes/dashboard.tsx": "export const a = 1;",
      "src/features/auth/routes/api/auth/$.ts": "export const b = 1;",
      "src/features/auth/e2e/api.auth.splat.route.spec.ts": "",
      "src/features/home/feature.json": "{}",
      "src/features/home/TIMELINE.md": "",
      "src/features/core/kv/feature.json": "{}",
      "src/features/core/kv/TIMELINE.md": "",
      "src/features/core/kv/routes/api/ping.ts": "export const c = 1;",
    });
    expect(
      lint(root, config)
        .filter((f) => f.rule === "test-map")
        .map((f) => f.message),
    ).toEqual([
      "missing its test: src/features/auth/e2e/dashboard.route.spec.ts",
      "missing its test: src/features/home/e2e/api.ping.route.spec.ts",
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
