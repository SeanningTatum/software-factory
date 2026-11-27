import ts from "@typescript/typescript6";
import { TEST_FILE } from "../files.ts";
import { collect } from "./ast-rules.ts";
import type { Rule } from "./types.ts";

const isLiteral = (e: ts.Expression): boolean => {
  if (
    ts.isStringLiteralLike(e) ||
    ts.isNumericLiteral(e) ||
    ts.isRegularExpressionLiteral(e) ||
    e.kind === ts.SyntaxKind.TrueKeyword ||
    e.kind === ts.SyntaxKind.FalseKeyword ||
    e.kind === ts.SyntaxKind.NullKeyword
  )
    return true;
  if (ts.isPrefixUnaryExpression(e)) return isLiteral(e.operand);
  if (ts.isArrayLiteralExpression(e)) return e.elements.every(isLiteral);
  if (ts.isObjectLiteralExpression(e))
    return e.properties.every((p) => ts.isPropertyAssignment(p) && isLiteral(p.initializer));
  return false;
};

const importedNames = (source: ts.SourceFile) => {
  const names = new Set<string>();
  for (const s of source.statements) {
    const clause = ts.isImportDeclaration(s) ? s.importClause : undefined;
    if (clause?.name) names.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const el of bindings.elements) names.add(el.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
  }
  return names;
};

const rootName = (e: ts.Expression): string | undefined => {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e))
    return rootName(e.expression);
  return undefined;
};

/** `for (const x of [A, B])` with every element a constant: `x` is a constant too. */
const loopOverConstants = (
  node: ts.Node,
  name: string,
  isConstant: (e: ts.Expression) => boolean,
) => {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (!ts.isForOfStatement(cur) || !ts.isVariableDeclarationList(cur.initializer)) continue;
    const declared = cur.initializer.declarations.some(
      (d) => ts.isIdentifier(d.name) && d.name.text === name,
    );
    if (declared)
      return (
        ts.isArrayLiteralExpression(cur.expression) && cur.expression.elements.every(isConstant)
      );
  }
  return false;
};

const constantIn = (source: ts.SourceFile) => {
  const imported = importedNames(source);
  const isConstant = (e: ts.Expression): boolean => {
    if (isLiteral(e)) return true;
    const name = rootName(e);
    if (name === undefined || ts.isCallExpression(e)) return false;
    return imported.has(name) || loopOverConstants(e, name, isConstant);
  };
  return isConstant;
};

/** The matcher call an `expect(...)` feeds: `expect(x).not.toBe(y)` gives `toBe(y)`. */
const matcherOf = (expectCall: ts.CallExpression): ts.CallExpression | undefined => {
  let cur: ts.Node = expectCall;
  while (ts.isPropertyAccessExpression(cur.parent)) cur = cur.parent;
  return ts.isCallExpression(cur.parent) && cur.parent.expression === cur ? cur.parent : undefined;
};

const callsIn = (body: ts.Node) => {
  const out: Array<ts.CallExpression> = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return out;
};

const isExpect = (n: ts.CallExpression) =>
  ts.isIdentifier(n.expression) && n.expression.text === "expect";

const TEST_CALL = /^(it|test)$/;

export const noRestatingTest: Rule = {
  id: "no-restating-test",
  description:
    "A test runs code. One that calls nothing and only checks constants against literals restates the source.",
  check: ({ file, source }) => {
    if (!TEST_FILE.test(file)) return [];
    const isConstant = constantIn(source);
    const restates = (e: ts.CallExpression) => {
      const subject = e.arguments[0];
      const matcher = matcherOf(e);
      return (
        subject !== undefined &&
        matcher !== undefined &&
        isConstant(subject) &&
        matcher.arguments.every(isLiteral)
      );
    };
    return collect(source, (n) => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return undefined;
      const body = n.arguments[1];
      if (!TEST_CALL.test(n.expression.text) || !body) return undefined;
      const calls = callsIn(body);
      const expects = calls.filter(isExpect);
      const asserting = new Set(expects.flatMap((e) => [e, matcherOf(e)]));
      // A test that calls the code under test checks its effects, mocks included.
      if (calls.some((c) => !asserting.has(c)) || !expects.length) return undefined;
      return expects.every(restates)
        ? "this test only checks constants against literals; test the code that uses them, or list the file in testExempt"
        : undefined;
    });
  },
};
