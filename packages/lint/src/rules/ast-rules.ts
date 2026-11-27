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

// Effect 4 adds the `…With` runners. Any mention counts, so a runner passed as a value is seen too.
const RUNNERS = /^run(Promise|Sync|Fork|Callback)(Exit)?(With)?$/;

export const noRunEffect: Rule = {
  id: "no-run-effect",
  description:
    "Only edges run effects: server functions go through runEffect, the worker through the request runtime.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isIdentifier(n) && RUNNERS.test(n.text)
        ? `${n.text} outside an edge; return the Effect and let the edge run it`
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

/** Whether a yield sits inside another yield's operand, in the same generator. */
const insideYield = (node: ts.Node): boolean => {
  for (let cur = node.parent; cur && !ts.isFunctionLike(cur); cur = cur.parent)
    if (ts.isYieldExpression(cur)) return true;
  return false;
};

export const noNestedYield: Rule = {
  id: "no-nested-yield",
  description: "One yield per expression: name the service, then call it.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isYieldExpression(n) && insideYield(n)
        ? "name the inner yield first: `const x = yield* X;` then `yield* x.method()`"
        : undefined,
    ),
};

export const fileSize: Rule = {
  id: "file-size",
  description: "Keep files small enough to read in one go.",
  check: ({ source, config }) => {
    // A final newline starts no line of its own.
    const lines = source.getLineStarts().length - (source.text.endsWith("\n") ? 1 : 0);
    return lines > config.maxLines
      ? [{ line: 1, message: `${lines} lines; split it below ${config.maxLines}` }]
      : [];
  },
};

/** `onClick={() => …}` or `onClick={function () {…}}`, parentheses and all. */
const isInlineFunction = (n: ts.Node): boolean => {
  if (!ts.isJsxAttribute(n) || !n.initializer || !ts.isJsxExpression(n.initializer)) return false;
  let e = n.initializer.expression;
  while (e && ts.isParenthesizedExpression(e)) e = e.expression;
  return e !== undefined && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));
};

export const noInlineHandler: Rule = {
  id: "no-inline-handler",
  description: "Pass a named function to a JSX prop (`onClick={signOut}`), not an inline one.",
  check: ({ source }) =>
    collect(source, (n) =>
      isInlineFunction(n)
        ? "name this function above the JSX and pass it: `onClick={handleClick}`"
        : undefined,
    ),
};
