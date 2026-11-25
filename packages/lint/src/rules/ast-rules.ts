import ts from "@typescript/typescript6";
import type { Rule } from "./types.ts";

const lineOf = (source: ts.SourceFile, node: ts.Node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const visit = (node: ts.Node, fn: (n: ts.Node) => void) => {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
};

const collect = (source: ts.SourceFile, match: (n: ts.Node) => string | undefined) => {
  const out: Array<{ line: number; message: string }> = [];
  visit(source, (n) => {
    const message = match(n);
    if (message) out.push({ line: lineOf(source, n), message });
  });
  return out;
};

const callee = (n: ts.Node) => (ts.isCallExpression(n) ? n.expression.getText() : undefined);

/** The called name, whatever it is reached through: `runPromise` for `E.runPromise(...)` or `runPromise(...)`. */
const calledName = (n: ts.Node): string | undefined => {
  if (!ts.isCallExpression(n)) return undefined;
  const e = n.expression;
  if (ts.isIdentifier(e)) return e.text;
  return ts.isPropertyAccessExpression(e) ? e.name.text : undefined;
};

export const noThrow: Rule = {
  id: "no-throw",
  description: "Fail in the error channel (`return yield* new SomeError()`), not with `throw`.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isThrowStatement(n)
        ? "use a tagged error in the Effect error channel instead of throw"
        : undefined,
    ),
};

export const noTryCatch: Rule = {
  id: "no-try-catch",
  description: "Wrap code that can throw in Effect.try / Effect.tryPromise.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isTryStatement(n) ? "use Effect.try or Effect.tryPromise instead of try/catch" : undefined,
    ),
};

const RUNNERS = /^run(Promise|PromiseExit|Sync|SyncExit|Fork|Callback)$/;

export const noRunEffect: Rule = {
  id: "no-run-effect",
  description:
    "Only edges run effects: server functions go through runEffect, the worker through the request runtime.",
  check: ({ source }) =>
    collect(source, (n) =>
      RUNNERS.test(calledName(n) ?? "")
        ? `${callee(n)} outside an edge; return the Effect and let the edge run it`
        : undefined,
    ),
};

/** `process` or `globalThis.process`. */
const isProcess = (e: ts.Expression): boolean =>
  (ts.isIdentifier(e) && e.text === "process") ||
  (ts.isPropertyAccessExpression(e) &&
    e.name.text === "process" &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === "globalThis");

/** Whether a node reads `env` off process: `.env`, `?.env`, `["env"]`, `{ env } = process`, or `import { env } from "node:process"`. */
const readsProcessEnv = (n: ts.Node): boolean => {
  if (ts.isPropertyAccessExpression(n)) return n.name.text === "env" && isProcess(n.expression);
  if (ts.isElementAccessExpression(n)) {
    const key = n.argumentExpression;
    return ts.isStringLiteralLike(key) && key.text === "env" && isProcess(n.expression);
  }
  if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name)) {
    const names = n.name.elements.map((el) => (el.propertyName ?? el.name).getText());
    return names.includes("env") && isProcess(n.initializer);
  }
  if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
    const bindings = n.importClause?.namedBindings;
    return (
      /^(node:)?process$/.test(n.moduleSpecifier.text) &&
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some((el) => (el.propertyName ?? el.name).text === "env")
    );
  }
  return false;
};

export const noProcessEnv: Rule = {
  id: "no-process-env",
  description: "Workers have no process.env; read settings from the CloudflareEnv service.",
  check: ({ source }) =>
    collect(source, (n) =>
      readsProcessEnv(n)
        ? "read settings from the CloudflareEnv service, not process.env"
        : undefined,
    ),
};

const isSpanned = (node: ts.Node): boolean => {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur)) {
      const text = cur.expression.getText();
      if (
        /^(?:\w+\.)?fn\(\s*["'`]/.test(text) ||
        (/^(?:\w+\.)?fn$/.test(text) &&
          cur.arguments[0] &&
          ts.isStringLiteralLike(cur.arguments[0]))
      )
        return true;
      if (/\.pipe$/.test(text) && cur.arguments.some((a) => /\bwithSpan\(/.test(a.getText())))
        return true;
    }
  }
  return false;
};

export const externalCallSpan: Rule = {
  id: "external-call-span",
  description:
    'Every outside call (Effect.tryPromise) runs inside Effect.fn("name") or pipes Effect.withSpan.',
  check: ({ source }) =>
    collect(source, (n) =>
      calledName(n) === "tryPromise" && !isSpanned(n)
        ? 'wrap this outside call in Effect.fn("Name.method") or pipe Effect.withSpan(...)'
        : undefined,
    ),
};

export const fileSize: Rule = {
  id: "file-size",
  description: "Keep files small enough to read in one go.",
  check: ({ source, config }) => {
    const lines = source.getLineStarts().length;
    return lines > config.maxLines
      ? [{ line: 1, message: `${lines} lines; split it below ${config.maxLines}` }]
      : [];
  },
};
