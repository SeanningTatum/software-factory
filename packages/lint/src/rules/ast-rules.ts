import ts from "typescript";
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

const callee = (n: ts.Node) =>
  ts.isCallExpression(n) ? n.expression.getText() : undefined;

export const noThrow: Rule = {
  id: "no-throw",
  description: "Fail in the error channel (`return yield* new SomeError()`), not with `throw`.",
  check: ({ source }) =>
    collect(source, (n) => (ts.isThrowStatement(n) ? "use a tagged error in the Effect error channel instead of throw" : undefined)),
};

export const noTryCatch: Rule = {
  id: "no-try-catch",
  description: "Wrap code that can throw in Effect.try / Effect.tryPromise.",
  check: ({ source }) =>
    collect(source, (n) => (ts.isTryStatement(n) ? "use Effect.try or Effect.tryPromise instead of try/catch" : undefined)),
};

const RUNNERS = /^Effect\.run(Promise|PromiseExit|Sync|SyncExit|Fork|Callback)$/;

export const noRunEffect: Rule = {
  id: "no-run-effect",
  description: "Only edges run effects: server functions go through runEffect, the worker through the request runtime.",
  check: ({ source }) =>
    collect(source, (n) => {
      const name = callee(n);
      return name && RUNNERS.test(name) ? `${name} outside an edge; return the Effect and let the edge run it` : undefined;
    }),
};

export const noProcessEnv: Rule = {
  id: "no-process-env",
  description: "Workers have no process.env; read settings from the CloudflareEnv service.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isPropertyAccessExpression(n) && n.getText() === "process.env"
        ? "read settings from the CloudflareEnv service, not process.env"
        : undefined,
    ),
};

const isSpanned = (node: ts.Node): boolean => {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur)) {
      const text = cur.expression.getText();
      if (/^Effect\.fn\(\s*["'`]/.test(text) || /^Effect\.fn$/.test(text) && cur.arguments[0] && ts.isStringLiteralLike(cur.arguments[0])) return true;
      if (/\.pipe$/.test(text) && cur.arguments.some((a) => /Effect\.withSpan\(/.test(a.getText()))) return true;
    }
  }
  return false;
};

export const externalCallSpan: Rule = {
  id: "external-call-span",
  description: "Every outside call (Effect.tryPromise) runs inside Effect.fn(\"name\") or pipes Effect.withSpan.",
  check: ({ source }) =>
    collect(source, (n) =>
      callee(n) === "Effect.tryPromise" && !isSpanned(n)
        ? 'wrap this outside call in Effect.fn("Name.method") or pipe Effect.withSpan(...)'
        : undefined,
    ),
};

export const fileSize: Rule = {
  id: "file-size",
  description: "Keep files small enough to read in one go.",
  check: ({ source, config }) => {
    const lines = source.getLineStarts().length;
    return lines > config.maxLines ? [{ line: 1, message: `${lines} lines; split it below ${config.maxLines}` }] : [];
  },
};
